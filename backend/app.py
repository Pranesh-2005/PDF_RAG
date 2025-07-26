import os
import threading
import time
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import shutil
import uuid

from langchain_openai import AzureOpenAIEmbeddings, AzureChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import CharacterTextSplitter
from langchain.chains import RetrievalQA

# Load credentials from .env
load_dotenv()
AZURE_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")  # For chat completion
AZURE_API_VERSION = os.getenv("AZURE_OPENAI_VERSION")

# Flask app setup
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

# Configuration
UPLOAD_FOLDER = "docs"
CHROMA_PATH = "embeddings"
CLEANUP_INTERVAL = 600  # 10 minutes in seconds
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {'pdf'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# File tracking for cleanup
file_timestamps = {}
cleanup_thread = None

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def cleanup_chroma_db():
    """Clean up corrupted Chroma database"""
    try:
        if os.path.exists(CHROMA_PATH):
            shutil.rmtree(CHROMA_PATH, ignore_errors=True)
            print("Cleaned up corrupted Chroma database")
            time.sleep(1)  # Wait a moment before recreating
    except Exception as e:
        print(f"Error cleaning up Chroma DB: {e}")

def cleanup_old_files():
    """Background thread to clean up old files every 10 minutes"""
    while True:
        try:
            current_time = datetime.now()
            files_to_delete = []
            
            # Check which files are older than 10 minutes
            for filename, timestamp in file_timestamps.copy().items():
                if current_time - timestamp > timedelta(seconds=CLEANUP_INTERVAL):
                    files_to_delete.append(filename)
            
            # Delete old files
            for filename in files_to_delete:
                file_path = os.path.join(UPLOAD_FOLDER, filename)
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"Auto-deleted old file: {filename}")
                
                # Remove from tracking
                if filename in file_timestamps:
                    del file_timestamps[filename]
            
            # Clean up embeddings if no files left
            if not file_timestamps and os.path.exists(CHROMA_PATH):
                cleanup_chroma_db()
            
        except Exception as e:
            print(f"Error in cleanup thread: {e}")
        
        time.sleep(60)  # Check every minute

def start_cleanup_thread():
    """Start the cleanup thread if not already running"""
    global cleanup_thread
    if cleanup_thread is None or not cleanup_thread.is_alive():
        cleanup_thread = threading.Thread(target=cleanup_old_files, daemon=True)
        cleanup_thread.start()
        print("Cleanup thread started")

# API Routes
@app.route("/", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "message": "AdvisorRAG API is running",
        "version": "1.0.0",
        "endpoints": {
            "upload": "/api/upload",
            "ask": "/api/ask",
            "list_files": "/api/list-files",
            "delete_file": "/api/delete/<filename>",
            "cleanup_status": "/api/cleanup-status"
        }
    })

@app.route("/api/upload", methods=["POST"])
def upload():
    try:
        if "pdf" not in request.files:
            return jsonify({"error": "Missing 'pdf' file in request."}), 400

        file = request.files["pdf"]
        if not file.filename:
            return jsonify({"error": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file format. Please upload a .pdf file."}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({"error": "File too large. Maximum size is 16MB."}), 400
        
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        # Track file timestamp for cleanup
        file_timestamps[filename] = datetime.now()
        
        # Start cleanup thread if not running
        start_cleanup_thread()
        
        return jsonify({
            "message": f"PDF '{filename}' uploaded successfully.",
            "filename": filename,
            "size": file_size,
            "auto_delete_in": CLEANUP_INTERVAL // 60  # minutes
        })
        
    except Exception as e:
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

@app.route("/api/delete/<filename>", methods=["DELETE"])
def delete_file(filename):
    try:
        # Security check
        filename = secure_filename(filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        if not os.path.exists(filepath):
            return jsonify({"error": "File not found"}), 404
        
        # Delete the file
        os.remove(filepath)
        
        # Remove from tracking
        if filename in file_timestamps:
            del file_timestamps[filename]
        
        # Clean up embeddings if no files left
        if not file_timestamps and os.path.exists(CHROMA_PATH):
            cleanup_chroma_db()
        
        return jsonify({"message": f"File '{filename}' deleted successfully."})
        
    except Exception as e:
        return jsonify({"error": f"Error deleting file: {str(e)}"}), 500

@app.route("/api/ask", methods=["POST"])
def ask():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON data"}), 400
            
        question = data.get("question")
        if not question or not question.strip():
            return jsonify({"error": "Question is required"}), 400

        question = question.strip()

        # Check if there are any PDFs
        pdf_files = [f for f in os.listdir(UPLOAD_FOLDER) if f.endswith(".pdf")]
        if not pdf_files:
            return jsonify({"error": "No PDF files found. Please upload at least one PDF first."}), 400

        # Load all PDFs
        docs = []
        for filename in pdf_files:
            try:
                loader = PyPDFLoader(os.path.join(UPLOAD_FOLDER, filename))
                docs.extend(loader.load())
            except Exception as e:
                print(f"Error loading {filename}: {e}")
                continue

        if not docs:
            return jsonify({"error": "No content found in PDF files."}), 400

        # Split into chunks
        text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        split_docs = text_splitter.split_documents(docs)

        if not split_docs:
            return jsonify({"error": "No text content could be extracted from PDFs."}), 400

        # Azure Embedding setup
        try:
            embeddings = AzureOpenAIEmbeddings(
                api_key=AZURE_API_KEY,
                azure_endpoint=AZURE_ENDPOINT,
                azure_deployment="text-embedding-ada-002",
                api_version=AZURE_API_VERSION,
            )
        except Exception as e:
            return jsonify({"error": f"Error setting up embeddings: {str(e)}"}), 500

        # Create Chroma DB with error handling
        try:
            # Generate unique collection name to avoid conflicts
            collection_name = f"docs_{str(uuid.uuid4())[:8]}"
            
            # Clean up any existing corrupted database
            if os.path.exists(CHROMA_PATH):
                try:
                    # Try to create a test collection first
                    test_db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
                    del test_db
                except Exception:
                    print("Detected corrupted Chroma DB, cleaning up...")
                    cleanup_chroma_db()
            
            db = Chroma.from_documents(
                documents=split_docs, 
                embedding=embeddings, 
                persist_directory=CHROMA_PATH,
                collection_name=collection_name
            )
            retriever = db.as_retriever(search_kwargs={"k": 3})
            
        except Exception as e:
            print(f"Chroma DB error: {e}")
            # Clean up and try again
            cleanup_chroma_db()
            try:
                collection_name = f"docs_{str(uuid.uuid4())[:8]}"
                db = Chroma.from_documents(
                    documents=split_docs, 
                    embedding=embeddings, 
                    persist_directory=CHROMA_PATH,
                    collection_name=collection_name
                )
                retriever = db.as_retriever(search_kwargs={"k": 3})
            except Exception as e2:
                return jsonify({"error": f"Database error: {str(e2)}"}), 500

        # QA chain
        try:
            llm = AzureChatOpenAI(
                azure_deployment=AZURE_DEPLOYMENT,
                api_key=AZURE_API_KEY,
                azure_endpoint=AZURE_ENDPOINT,
                api_version=AZURE_API_VERSION,
                temperature=0.1,
                max_tokens=1000
            )

            qa = RetrievalQA.from_chain_type(
                llm=llm, 
                chain_type="stuff",
                retriever=retriever, 
                return_source_documents=True
            )

            result = qa.invoke({"query": question})
            
        except Exception as e:
            return jsonify({"error": f"Error processing question: {str(e)}"}), 500
        
        # Get source documents for reference
        source_docs = result.get("source_documents", [])
        sources = []
        for doc in source_docs[:3]:  # Limit to top 3 sources
            sources.append({
                "content": doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content,
                "source": doc.metadata.get("source", "Unknown"),
                "page": doc.metadata.get("page", "N/A")
            })
        
        return jsonify({
            "answer": result["result"],
            "sources": sources,
            "question": question
        })
        
    except Exception as e:
        print(f"Unexpected error in ask endpoint: {e}")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

@app.route("/api/list-files", methods=["GET"])
def list_files():
    try:
        pdf_files = [f for f in os.listdir(UPLOAD_FOLDER) if f.endswith(".pdf")]
        
        # Include upload time for each file
        files_with_info = []
        for filename in pdf_files:
            upload_time = file_timestamps.get(filename)
            time_remaining = None
            file_size = 0
            
            try:
                file_size = os.path.getsize(os.path.join(UPLOAD_FOLDER, filename))
            except:
                pass
            
            if upload_time:
                elapsed = datetime.now() - upload_time
                remaining_seconds = CLEANUP_INTERVAL - elapsed.total_seconds()
                if remaining_seconds > 0:
                    time_remaining = int(remaining_seconds / 60)  # Convert to minutes
            
            files_with_info.append({
                "name": filename,
                "size": file_size,
                "time_remaining": time_remaining,
                "upload_time": upload_time.isoformat() if upload_time else None
            })
        
        return jsonify({
            "files": files_with_info,
            "total_files": len(files_with_info),
            "cleanup_interval": CLEANUP_INTERVAL // 60
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/cleanup-status", methods=["GET"])
def cleanup_status():
    """Get cleanup status and remaining time for files"""
    try:
        current_time = datetime.now()
        status = {
            "cleanup_interval": CLEANUP_INTERVAL // 60,  # in minutes
            "total_files": len(file_timestamps),
            "files": []
        }
        
        for filename, timestamp in file_timestamps.items():
            elapsed = current_time - timestamp
            remaining_seconds = CLEANUP_INTERVAL - elapsed.total_seconds()
            
            status["files"].append({
                "filename": filename,
                "uploaded_at": timestamp.isoformat(),
                "minutes_remaining": max(0, int(remaining_seconds / 60))
            })
        
        return status
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    # Clean up any existing corrupted database on startup
    cleanup_chroma_db()
    
    # Start cleanup thread when app starts
    start_cleanup_thread()
    
    # Get port from environment variable (Render requirement)
    port = int(os.environ.get("PORT", 5000))
    
    # Run app
    app.run(host="0.0.0.0", port=port, debug=True)