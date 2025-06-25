# Agentic Resume Generator
This project is a full-stack web application that leverages a large language model (LLM) to act as an "agentic" assistant for updating resumes. Users can upload their existing resume, provide instructions for changes in natural language, and receive professionally formatted LaTeX code ready for PDF compilation.

The application is designed with a sleek, minimalist user interface and a robust backend that intelligently parses user requests, updates a structured representation of the resume, and generates the final output in the popular "Jake's Resume" LaTeX format.

## Features
- AI-Powered Editing: Simply describe the changes you want—add a new job, update a project, remove a section—and the AI agent will handle the rest.
- Local PDF & Text Parsing: Upload your existing resume in .pdf or .txt format. The frontend parses the file locally to extract the text, reducing API calls.
- Structured JSON Generation: The AI agent converts the parsed resume and your instructions into a clean, structured JSON object.
- High-Quality LaTeX Output: The backend uses the generated JSON to create a syntactically correct .tex file based on the "Jake's Resume" template.
- Direct Overleaf Integration: Instantly open your generated resume in Overleaf, a free online LaTeX editor, to compile and download your final PDF.
- Modern, Minimalist UI: A clean, responsive user interface built with React, featuring a custom dropzone for file uploads and a typewriter-style font for a focused experience.
