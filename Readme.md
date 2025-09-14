# PDF_RAG

# 📄 PDF_RAG

PDF_RAG is an open-source project that enables advanced retrieval-augmented generation (RAG) over PDF files, combining a modern backend and frontend for seamless, interactive document question-answering.

---

## 🚀 Introduction

PDF_RAG provides a full-stack solution for uploading PDF documents, querying them with natural language, and receiving context-rich answers powered by Large Language Models (LLMs). The backend leverages Flask, LangChain, and OpenAI APIs, while the frontend offers a modern, responsive interface built with Next.js and React.

---

## ✨ Features

- **PDF Upload & Management:** Upload, list, and delete PDF files from an intuitive UI.
- **RAG-powered Q&A:** Ask questions about your PDFs and get real-time, context-aware answers.
- **Source Highlighting:** Answers include references to document sources.
- **Modern Frontend:** Built with React and Next.js for speed and user experience.
- **Theme Support:** Dark/light mode switching.
- **Robust Backend:** Flask API with file handling, CORS, and environment management.
- **Extensible UI Components:** Includes reusable components (chat, file-list, file-upload, alerts, dialogs, etc.).

---

## 🛠️ Installation

### Prerequisites

- Python 3.9+
- Node.js 18+
- npm or yarn

### Backend Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Pranesh-2005/PDF_RAG.git
   cd PDF_RAG/backend
   ```

2. **Create a virtual environment and install dependencies:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure environment variables:**
   - Copy `.env.example` to `.env` and set your OpenAI and other credentials.

4. **Start the backend server:**
   ```bash
   python app.py
   ```

### Frontend Setup (Next.js)

1. **Navigate to frontend directory:**
   ```bash
   cd ../nxtFrontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

---

## 💡 Usage

1. **Start both backend and frontend servers.**
2. **Access the frontend via** [http://localhost:3000](http://localhost:3000).
3. **Upload PDF files** using the file-upload component.
4. **Ask questions** about your PDFs in the chat interface.
5. **View answers and sources** interactively.

---

## 🤝 Contributing

Contributions are welcome! 🛠️

1. Fork the repository.
2. Create a new branch (`git checkout -b my-feature`).
3. Make your changes.
4. Submit a pull request.


---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

> Made with ❤️ for document intelligence and open-source collaboration.

## License
This project is licensed under the **MIT** License.

---
🔗 GitHub Repo: https://github.com/Pranesh-2005/PDF_RAG