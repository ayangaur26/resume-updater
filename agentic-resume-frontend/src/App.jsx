import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

// --- Inline SVG Icons ---
const UpArrowIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>;
const FileTextIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>;
const RemoveIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>;
const CopyIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
const ExternalLinkIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" /></svg>;
const LoaderIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line><style>{`.animate-spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style></svg>;

export default function App() {
    const [instructions, setInstructions] = useState('');
    const [resumeFile, setResumeFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [texCode, setTexCode] = useState(`% Your generated LaTeX code will appear here.`);
    const [error, setError] = useState('');

    const fileInputRef = useRef(null);
    const overleafFormRef = useRef(null);

    const isGenerateButtonActive = instructions.trim() !== '' && resumeFile !== null;
    const isOverleafButtonActive = texCode && !texCode.startsWith('%');

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setResumeFile(file);
        }
        e.target.value = null; 
    };
    
    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
             setResumeFile(file);
        }
    };
    
    const handleGenerateClick = async () => {
        if (!isGenerateButtonActive || isLoading) return;

        setIsLoading(true);
        setError('');
        setTexCode('% Processing your resume...');

        try {
            let parsedResumeText = '';
            if (resumeFile.type === 'application/pdf') {
                const fileReader = new FileReader();
                fileReader.readAsArrayBuffer(resumeFile);
                parsedResumeText = await new Promise((resolve, reject) => {
                    fileReader.onload = async (e) => {
                        try {
                            const typedarray = new Uint8Array(e.target.result);
                            const pdf = await pdfjsLib.getDocument(typedarray).promise;
                            let textContent = Array.from({ length: pdf.numPages }, async (_, i) => {
                                const page = await pdf.getPage(i + 1);
                                const text = await page.getTextContent();
                                return text.items.map(s => s.str).join(' ');
                            });
                            resolve((await Promise.all(textContent)).join('\n'));
                        } catch (pdfError) { reject(pdfError); }
                    };
                    fileReader.onerror = (err) => reject(err);
                });
            } else {
                parsedResumeText = await resumeFile.text();
            }

            const backendUrl = ''; // Use relative path for production
            const response = await fetch(`${backendUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instructions, resumeText: parsedResumeText }),
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || 'An unknown server error occurred.');
            }
            
            const data = await response.json();
            setTexCode(data.tex);

        } catch (err) {
            setError(`Failed to generate resume: ${err.message}`);
            setTexCode(`% Generation failed. Please check the .tex output for errors.`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCopyToClipboard = () => {
        if (!isOverleafButtonActive) return;
        navigator.clipboard.writeText(texCode).then(() => alert("LaTeX code copied!"));
    };
    
    const handleOpenInOverleaf = () => {
         if (!isOverleafButtonActive || !overleafFormRef.current) return;
         overleafFormRef.current.submit();
    };


    return (
        <div className="app-shell">
            <div className="input-panel">
                <div 
                    className="input-area"
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <div className="input-header">
                       <h1>AI Powered Resume Modifier</h1>
                       <p>Describe your changes and attach your resume. We will handle the rest for you.</p>
                    </div>
                    <div className={`dropzone ${isDragging ? 'dragging-over' : ''}`}>
                         <textarea
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder="e.g., Add a new job: Software Engineer at Acme Inc..."
                            className="instructions-textarea"
                            disabled={isLoading}
                        />
                        <div className="input-toolbar">
                            <div className="attachment-area">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="visually-hidden"
                                    accept=".pdf,.txt"
                                />
                                {!resumeFile && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current.click()}
                                        className="upload-text-button"
                                        title="Upload Resume"
                                        disabled={isLoading}
                                    >
                                        Attach Resume
                                    </button>
                                )}
                                {resumeFile && (
                                   <div className="file-chip">
                                       <FileTextIcon />
                                       <span style={{ marginLeft: '0.5rem' }}>{resumeFile.name}</span>
                                       <button 
                                         onClick={() => setResumeFile(null)} 
                                         className="file-chip-remove"
                                         disabled={isLoading}
                                       >
                                         <RemoveIcon />
                                       </button>
                                   </div>
                                )}
                            </div>
                            <button
                                onClick={handleGenerateClick}
                                className="send-button"
                                disabled={!isGenerateButtonActive || isLoading}
                                title="Generate Resume"
                            >
                                {isLoading ? <LoaderIcon /> : <UpArrowIcon />}
                            </button>
                        </div>
                    </div>
                    {error && <div className="error-container">{error}</div>}
                    <div className="built-by-footer">
                       Built by Ayan Gaur.
                    </div>
                </div>
            </div>
            <div className="output-panel">
                 <header className="output-header">
                    <h2>Generated LaTeX</h2>
                    <div className="output-buttons">
                        <button onClick={handleCopyToClipboard} disabled={!isOverleafButtonActive || isLoading}><CopyIcon /> Copy .tex</button>
                        <button onClick={handleOpenInOverleaf} disabled={!isOverleafButtonActive || isLoading}><ExternalLinkIcon /> Open in Overleaf</button>
                    </div>
                </header>
                <main className="output-main">
                    <pre><code>{isLoading ? '% Processing...' : texCode}</code></pre>
                </main>
            </div>
             {/* Hidden form for submitting to Overleaf */}
            <form ref={overleafFormRef} action="https://www.overleaf.com/docs" method="post" target="_blank" style={{ display: 'none' }}>
                <input type="hidden" name="snip" value={texCode} />
            </form>
        </div>
    );
}
