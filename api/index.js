// api/index.js

const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// NOTE: In a Vercel serverless environment, only the /tmp directory is writable.
const tmpDir = path.join('/tmp');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const resumeJsonStructure = {
    name: "Full Name",
    email: "email@example.com",
    phone: "555-555-5555",
    linkedin: "your-linkedin-profile-url", // no https://
    github: "your-github-username",      // no https://
    education: [
        { institution: "University Name", degree: "B.S. in Computer Science", dates: "Aug 2018 - May 2021" }
    ],
    experience: [
        { company: "Company Inc.", role: "Software Engineer", dates: "May 2021 - Present", location: "City, ST", description: ["Developed feature X using React."] }
    ],
    projects: [
        { name: "Project Name", technologies: "React, Node.js, Python", dates: "Jun 2020", description: ["Built a web app for X.", "Implemented Y feature."] }
    ],
    skills: {
        languages: "Python, JavaScript, SQL",
        frameworks: "React, Node.js, Flask",
        developerTools: "Git, Docker, VS Code",
        libraries: "pandas, NumPy, Matplotlib"
    }
};

const systemPrompt = `
You are an expert resume-building AI assistant. Your task is to act as a data processor.
You will receive the plain text of a user's current resume and a set of instructions for changes.
Your one and only job is to return a single, valid JSON object that represents the final, updated resume.
First, parse the 'Current Resume Text' into the provided JSON structure.
Then, apply the 'User's Instructions' to modify that JSON object.
Finally, return the complete, modified JSON object.

RULES:
- Your entire output MUST be a single, valid JSON object.
- DO NOT add any conversational text, explanations, or markdown fences.
- The 'description' field for each experience and project item must be an array of strings.
- When writing or updating bullet points in the 'description' fields, ensure they are phrased professionally and aim for a single line on a standard PDF, keeping it too short or just one word longer than a line is problematic so dont do that.
- When generating or updating any 'dates' field, use 3-letter abbreviations for months (e.g., Jun, Aug, Sep).
- Do not add full stops to the end of bullet points
- Ensure there are no unnecessary white-spaces such as empty lines
- **Skill Integration Rule:** When a user adds a new project or experience, you must analyze the technologies and description for any technical skills (languages, frameworks, tools, libraries). For each skill found, you must check if it is already listed in the main 'skills' object at the root of the JSON. If it is NOT listed, you must add it to the appropriate string in the 'skills' object (e.g., add "React" to 'skills.frameworks'). Do NOT list the technologies in the project's own description bullets.
- Adhere strictly to this JSON structure: ${JSON.stringify(resumeJsonStructure)}
`;

const generateTex = (resume) => {
    const escapeTex = (str) => {
        if (!str) return '';
        return str.toString()
            .replace(/\\/g, '\\textbackslash{}')
            .replace(/&/g, '\\&').replace(/%/g, '\\%').replace(/\$/g, '\\$')
            .replace(/#/g, '\\#').replace(/_/g, '\\_').replace(/{/g, '\\{')
            .replace(/}/g, '\\}').replace(/~/g, '\\textasciitilde{}')
            .replace(/\^/g, '\\textasciicircum{}')
            .replace(/μ/g, '$\\mu$').replace(/α/g, '$\\alpha$').replace(/β/g, '$\\beta$');
    };
    const workItems = (resume.experience || []).map(exp => `
    \\resumeSubheading{${escapeTex(exp.company)}}{${escapeTex(exp.dates)}}{${escapeTex(exp.role)}}{${escapeTex(exp.location || '')}}
        \\resumeItemListStart
            ${(Array.isArray(exp.description) ? exp.description : []).filter(d => d && d.trim() !== '').map(d => `\\resumeItem{${escapeTex(d)}}`).join('\n            ')}
        \\resumeItemListEnd`).join('');
    const eduItems = (resume.education || []).map(edu => `
    \\resumeSubheading{${escapeTex(edu.institution)}}{${escapeTex(edu.dates)}}{${escapeTex(edu.degree)}}{${escapeTex(edu.details || '')}}`).join('');
    const projectItems = (resume.projects || []).map(proj => `
    \\resumeProjectHeading{\\textbf{${escapeTex(proj.name)}}}{${escapeTex(proj.dates)}}
        \\resumeItemListStart
            ${(Array.isArray(proj.description) ? proj.description : []).filter(d => d && d.trim() !== '').map(d => `\\resumeItem{${escapeTex(d)}}`).join('\n            ')}
        \\resumeItemListEnd`).join('');
    const skills = resume.skills || {};
    const skillItems = [
        skills.languages && `\\textbf{Languages}{: ${escapeTex(skills.languages)}}`,
        skills.frameworks && `\\textbf{Frameworks}{: ${escapeTex(skills.frameworks)}}`,
        skills.developerTools && `\\textbf{Developer Tools}{: ${escapeTex(skills.developerTools)}}`,
        skills.libraries && `\\textbf{Libraries}{: ${escapeTex(skills.libraries)}}`
    ].filter(Boolean).join(' \\\\\n      ');
    return `
\\documentclass[letterpaper,11pt]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{fontawesome5}
\\usepackage{multicol}
\\usepackage{lmodern}
\\setlength{\\multicolsep}{0pt}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\setlength{\\footskip}{4.08003pt}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}
\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}
\\titleformat{\\section}{\\vspace{-4pt}\\scshape\\raggedright\\large}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]
\\pdfgentounicode=1
\\newcommand{\\resumeItem}[1]{\\item\\small{{#1 \\vspace{-2pt}}}}
\\newcommand{\\resumeSubheading}[4]{\\vspace{-2pt}\\item\\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}\\textbf{#1} & #2 \\\\ \\textit{\\small#3} & \\textit{\\small #4} \\\\ \\end{tabular*}\\vspace{-7pt}}
\\newcommand{\\resumeProjectHeading}[2]{\\item\\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}\\small#1 & #2 \\\\ \\end{tabular*}\\vspace{-7pt}}
\\renewcommand\\labelitemii{\\textbullet}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}
\\begin{document}
\\begin{center}
    \\textbf{\\Huge \\scshape ${escapeTex(resume.name)}} \\\\ \\vspace{1pt}
    \\small ${resume.phone ? `${escapeTex(resume.phone)} $\\|$` : ''} \\href{mailto:${escapeTex(resume.email)}}{\\underline{${escapeTex(resume.email)}}} ${resume.linkedin ? `$\\|$ \\href{https://${escapeTex(resume.linkedin)}}{\\underline{${escapeTex(resume.linkedin)}}}` : ''} ${resume.github ? `$\\|$ \\href{https://github.com/${escapeTex(resume.github)}}{\\underline{github.com/${escapeTex(resume.github)}}}` : ''}
\\end{center}
${eduItems ? `\\section{Education}\\resumeSubHeadingListStart ${eduItems} \\resumeSubHeadingListEnd` : ''}
${workItems ? `\\section{Experience}\\resumeSubHeadingListStart ${workItems} \\resumeSubHeadingListEnd` : ''}
${projectItems ? `\\section{Projects}\\resumeSubHeadingListStart ${projectItems} \\resumeSubHeadingListEnd` : ''}
${skillItems ? `\\section{Technical Skills}\\begin{itemize}[leftmargin=0.15in, label={}]\\small{\\item{ ${skillItems} }}\\end{itemize}` : ''}
\\end{document}
`;
};

app.post('/api/generate', async (req, res) => {
    const uniqueId = `resume-${Date.now()}`;
    const texFilePath = path.join(tmpDir, `${uniqueId}.tex`);
    const pdfFilePath = path.join(tmpDir, `${uniqueId}.pdf`);

    try {
        const { instructions, resumeText } = req.body;
        if (!instructions || !resumeText) {
            return res.status(400).json({ error: "Missing instructions or resume text." });
        }
        
        const prompt = `${systemPrompt}\n\n## User's Instructions:\n${instructions}\n\n## User's Current Resume Text:\n${resumeText}`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("AI response did not contain a valid JSON object.");
        }
        const cleanedJsonString = jsonMatch[0];
        const resumeJson = JSON.parse(cleanedJsonString);
        
        const texCode = generateTex(resumeJson);
        fs.writeFileSync(texFilePath, texCode);
        
        // Note: For Vercel deployment, pdflatex must be installed via a custom build environment.
        // The simplest way is to use a Dockerfile.
        const command = `pdflatex -interaction=nonstopmode -output-directory=${tmpDir} -jobname=${uniqueId} ${texFilePath}`;
        
        await new Promise((resolve, reject) => {
            exec(command, { timeout: 25000 }, (error, stdout, stderr) => {
                if (error) {
                    const logFilePath = path.join(tmpDir, `${uniqueId}.log`);
                    let logContent = fs.existsSync(logFilePath) ? fs.readFileSync(logFilePath, 'utf8') : 'Could not read log file.';
                    console.error(`exec error: ${error.message}`);
                    const detailedError = `LaTeX compilation failed. Log: \n${logContent}`;
                    return reject(new Error(detailedError));
                }
                resolve(stdout);
            });
        });

        // Read the generated PDF into a buffer and convert to Base64
        const pdfBuffer = fs.readFileSync(pdfFilePath);
        const pdfBase64 = pdfBuffer.toString('base64');
        
        res.json({ 
            tex: texCode, 
            pdfBase64: pdfBase64 
        });

    } catch (error) {
        console.error("Error processing generation request:", error);
        res.status(500).json({ 
            error: error.message || "An internal server error occurred."
        });
    } finally {
        // Cleanup all generated files from the /tmp directory
        const extensionsToDelete = ['.tex', '.aux', '.log', '.pdf'];
        extensionsToDelete.forEach(ext => {
            const fileToDelete = path.join(tmpDir, `${uniqueId}${ext}`);
            if(fs.existsSync(fileToDelete)) fs.unlinkSync(fileToDelete);
        });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
