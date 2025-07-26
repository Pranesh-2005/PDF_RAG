import os
import threading
import time
import traceback
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import shutil
import uuid
import gc

from langchain_openai import AzureOpenAIEmbeddings, AzureChatOpenAI
from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import CharacterTextSplitter
from langchain.chains import RetrievalQA

# Load credentials from .env
load_dotenv()
AZURE_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")  # For chat completion
AZURE_API_VERSION = os.getenv("AZURE_OPENAI_VERSION")

# Validate environment variables
if not all([AZURE_API_KEY, AZURE_ENDPOINT, AZURE_DEPLOYMENT, AZURE_API_VERSION]):
    print("ERROR: Missing required Azure OpenAI environment variables!")
    print(f"AZURE_API_KEY: {'✓' if AZURE_API_KEY else '✗'}")
    print(f"AZURE_ENDPOINT: {'✓' if AZURE_ENDPOINT else '✗'}")
    print(f"AZURE_DEPLOYMENT: {'✓' if AZURE_DEPLOYMENT else '✗'}")
    print(f"AZURE_API_VERSION: {'✓' if AZURE_API_VERSION else '✗'}")

# Flask app setup
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

# Configuration
UPLOAD_FOLDER = "docs"
CLEANUP_INTERVAL = 600  # 10 minutes in seconds
RESPONSE_CLEANUP_DELAY = 60  # 1 minute after response in seconds
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {'pdf'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# File tracking for cleanup
file_timestamps = {}
cleanup_thread = None
# Track active ChromaDB instances for cleanup
active_db_instances = {}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def cleanup_db_instance(session_id):
    """Clean up a specific ChromaDB instance after delay"""
    def delayed_cleanup():
        time.sleep(RESPONSE_CLEANUP_DELAY)
        try:
            if session_id in active_db_instances:
                db_instance = active_db_instances[session_id]
                # Delete the collection
                try:
                    db_instance.delete_collection()
                    print(f"Cleaned up ChromaDB collection for session: {session_id}")
                except:
                    pass
                
                # Remove from tracking
                del active_db_instances[session_id]
                
                # Force garbage collection
                del db_instance
                gc.collect()
                print(f"Memory cleanup completed for session: {session_id}")
        except Exception as e:
            print(f"Error in DB cleanup: {e}")
    
    # Start cleanup thread
    cleanup_thread = threading.Thread(target=delayed_cleanup, daemon=True)
    cleanup_thread.start()

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
        
        # Clear any existing DB instances when new file is uploaded
        for session_id in list(active_db_instances.keys()):
            try:
                active_db_instances[session_id].delete_collection()
                del active_db_instances[session_id]
            except:
                pass
        gc.collect()
        print("Cleared existing embeddings due to new file upload")
        
        return jsonify({
            "message": f"PDF '{filename}' uploaded successfully.",
            "filename": filename,
            "size": file_size,
            "auto_delete_in": CLEANUP_INTERVAL // 60  # minutes
        })
        
    except Exception as e:
        print(f"Upload error: {str(e)}")
        traceback.print_exc()
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
        
        return jsonify({"message": f"File '{filename}' deleted successfully."})
        
    except Exception as e:
        print(f"Delete error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"Error deleting file: {str(e)}"}), 500

@app.route("/api/ask", methods=["POST"])
def ask():
    session_id = None
    try:
        print("=== ASK REQUEST STARTED ===")
        
        # Generate unique session ID for this request
        session_id = str(uuid.uuid4())[:8]
        print(f"Session ID: {session_id}")
        
        # Check environment variables first
        if not all([AZURE_API_KEY, AZURE_ENDPOINT, AZURE_DEPLOYMENT, AZURE_API_VERSION]):
            print("ERROR: Missing Azure OpenAI credentials")
            return jsonify({"error": "Server configuration error: Missing Azure OpenAI credentials"}), 500
        
        data = request.get_json()
        if not data:
            print("ERROR: Invalid JSON data")
            return jsonify({"error": "Invalid JSON data"}), 400
            
        question = data.get("question")
        if not question or not question.strip():
            print("ERROR: Question is required")
            return jsonify({"error": "Question is required"}), 400

        question = question.strip()
        print(f"Question: {question}")

        # Check if there are any PDFs
        pdf_files = [f for f in os.listdir(UPLOAD_FOLDER) if f.endswith(".pdf")]
        print(f"Found PDF files: {pdf_files}")
        
        if not pdf_files:
            print("ERROR: No PDF files found")
            return jsonify({"error": "No PDF files found. Please upload at least one PDF first."}), 400

        # Load all PDFs
        docs = []
        for filename in pdf_files:
            try:
                print(f"Loading PDF: {filename}")
                loader = PyPDFLoader(os.path.join(UPLOAD_FOLDER, filename))
                file_docs = loader.load()
                docs.extend(file_docs)
                print(f"Loaded {len(file_docs)} documents from {filename}")
            except Exception as e:
                print(f"Error loading {filename}: {e}")
                continue

        if not docs:
            print("ERROR: No content found in PDF files")
            return jsonify({"error": "No content found in PDF files."}), 400

        print(f"Total documents loaded: {len(docs)}")

        # Split into chunks
        text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        split_docs = text_splitter.split_documents(docs)
        print(f"Split into {len(split_docs)} chunks")

        if not split_docs:
            print("ERROR: No text content could be extracted")
            return jsonify({"error": "No text content could be extracted from PDFs."}), 400

        # Azure Embedding setup
        try:
            print("Setting up Azure embeddings...")
            embeddings = AzureOpenAIEmbeddings(
                api_key=AZURE_API_KEY,
                azure_endpoint=AZURE_ENDPOINT,
                azure_deployment="text-embedding-ada-002",
                api_version=AZURE_API_VERSION,
            )
            print("Embeddings setup successful")
        except Exception as e:
            print(f"Error setting up embeddings: {str(e)}")
            traceback.print_exc()
            return jsonify({"error": f"Error setting up embeddings: {str(e)}"}), 500

        # Create IN-MEMORY Chroma DB with unique collection name
        try:
            print("Creating in-memory Chroma database...")
            collection_name = f"docs_{session_id}"
            
            # Use in-memory database (no persist_directory)
            db = Chroma.from_documents(
                documents=split_docs, 
                embedding=embeddings,
                collection_name=collection_name
                # No persist_directory = in-memory only
            )
            
            # Store DB instance for later cleanup
            active_db_instances[session_id] = db
            
            retriever = db.as_retriever(search_kwargs={"k": 3})
            print(f"In-memory Chroma database created successfully with collection: {collection_name}")
            
        except Exception as e:
            print(f"Chroma DB error: {e}")
            traceback.print_exc()
            return jsonify({"error": f"Database error: {str(e)}"}), 500

        # QA chain
        try:
            print("Setting up Azure Chat OpenAI...")
            llm = AzureChatOpenAI(
                azure_deployment=AZURE_DEPLOYMENT,
                api_key=AZURE_API_KEY,
                azure_endpoint=AZURE_ENDPOINT,
                api_version=AZURE_API_VERSION,
                temperature=0.1,
                max_tokens=1000
            )
            print("Azure Chat OpenAI setup successful")

            print("Creating QA chain...")
            qa = RetrievalQA.from_chain_type(
                llm=llm, 
                chain_type="stuff",
                retriever=retriever, 
                return_source_documents=True
            )
            print("QA chain created successfully")

            print("Processing question...")
            result = qa.invoke({"query": question})
            print("Question processed successfully")
            
        except Exception as e:
            print(f"Error processing question: {str(e)}")
            traceback.print_exc()
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
        
        print("=== ASK REQUEST COMPLETED ===")
        
        # Schedule cleanup of this DB instance after 1 minute
        if session_id:
            cleanup_db_instance(session_id)
            print(f"Scheduled cleanup for session {session_id} in {RESPONSE_CLEANUP_DELAY} seconds")
        
        return jsonify({
            "answer": result["result"],
            "sources": sources,
            "question": question,
            "session_id": session_id
        })
        
    except Exception as e:
        print(f"Unexpected error in ask endpoint: {e}")
        traceback.print_exc()
        
        # Clean up on error
        if session_id and session_id in active_db_instances:
            try:
                active_db_instances[session_id].delete_collection()
                del active_db_instances[session_id]
            except:
                pass
        
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
            "cleanup_interval": CLEANUP_INTERVAL // 60,
            "active_sessions": len(active_db_instances)
        })
        
    except Exception as e:
        print(f"List files error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/cleanup-status", methods=["GET"])
def cleanup_status():
    """Get cleanup status and remaining time for files"""
    try:
        current_time = datetime.now()
        status = {
            "cleanup_interval": CLEANUP_INTERVAL // 60,  # in minutes
            "total_files": len(file_timestamps),
            "active_db_sessions": len(active_db_instances),
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
        print(f"Cleanup status error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    print(f"Internal server error: {error}")
    return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    # Start cleanup thread when app starts
    start_cleanup_thread()
    
    # Get port from environment variable (Render requirement)
    port = int(os.environ.get("PORT", 5000))
    
    print(f"Starting server on port {port}")
    print(f"Environment check:")
    print(f"  AZURE_API_KEY: {'✓' if AZURE_API_KEY else '✗'}")
    print(f"  AZURE_ENDPOINT: {'✓' if AZURE_ENDPOINT else '✗'}")
    print(f"  AZURE_DEPLOYMENT: {'✓' if AZURE_DEPLOYMENT else '✗'}")
    print(f"  AZURE_API_VERSION: {'✓' if AZURE_API_VERSION else '✗'}")
    
    # Run app
    app.run(host="0.0.0.0", port=port, debug=False)  # Set debug=False for production