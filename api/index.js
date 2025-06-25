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
app.use('/public', express.static(path.join(__dirname, 'public')));

const publicDir = path.join(__dirname, 'public');
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

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
        // This function now handles both structural LaTeX characters and common unicode symbols.
        return str.toString()
            // First, escape the structural characters. Order is important.
            .replace(/\\/g, '\\textbackslash{}')
            .replace(/&/g, '\\&').replace(/%/g, '\\%').replace(/\$/g, '\\$')
            .replace(/#/g, '\\#').replace(/_/g, '\\_').replace(/{/g, '\\{')
            .replace(/}/g, '\\}').replace(/~/g, '\\textasciitilde{}')
            .replace(/\^/g, '\\textasciicircum{}')
            // Then, convert common unicode math/science symbols.
            .replace(/μ/g, '$\\mu$') // mu -> \mu
            .replace(/α/g, '$\\alpha$') // alpha -> \alpha
            .replace(/β/g, '$\\beta$') // beta -> \beta
            .replace(/→/g, '$\\rightarrow$') // right arrow -> \rightarrow
            .replace(/•/g, '$\\bullet$'); // bullet -> \bullet
    };

    const workItems = (resume.experience || []).map(exp => {
        const descriptionPoints = Array.isArray(exp.description) ? exp.description : [];
        const items = descriptionPoints.filter(d => d && d.trim() !== '').map(d => `\\resumeItem{${escapeTex(d)}}`).join('\n            ');
        return `
    \\resumeSubheading
        {${escapeTex(exp.company)}}{${escapeTex(exp.dates)}}
        {${escapeTex(exp.role)}}{${escapeTex(exp.location || '')}}
        \\resumeItemListStart
            ${items}
        \\resumeItemListEnd`;
    }).join('');

    const eduItems = (resume.education || []).map(edu => `
    \\resumeSubheading
        {${escapeTex(edu.institution)}}{${escapeTex(edu.dates)}}
        {${escapeTex(edu.degree)}}{${escapeTex(edu.details || '')}}`).join('');

    const projectItems = (resume.projects || []).map(proj => {
        const descriptionPoints = Array.isArray(proj.description) ? proj.description : [];
        const items = descriptionPoints.filter(d => d && d.trim() !== '').map(d => `\\resumeItem{${escapeTex(d)}}`).join('\n            ');
        return `
    \\resumeProjectHeading
        {\\textbf{${escapeTex(proj.name)}}}{${escapeTex(proj.dates)}}
        \\resumeItemListStart
            ${items}
        \\resumeItemListEnd`;
    }).join('');
    
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
\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]
\\pdfgentounicode=1
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}
\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeSubSubheading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textit{\\small#1} & \\textit{\\small #2} \\\\
    \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}
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
${eduItems ? `\\section{Education}
    \\resumeSubHeadingListStart
    ${eduItems}
    \\resumeSubHeadingListEnd` : ''}
${workItems ? `\\section{Experience}
    \\resumeSubHeadingListStart
    ${workItems}
    \\resumeSubHeadingListEnd` : ''}
${projectItems ? `\\section{Projects}
    \\resumeSubHeadingListStart
    ${projectItems}
    \\resumeSubHeadingListEnd` : ''}
${skillItems ? `\\section{Technical Skills}
    \\begin{itemize}[leftmargin=0.15in, label={}]
        \\small{\\item{
        ${skillItems}
        }}
    \\end{itemize}` : ''}
\\end{document}
`;
};

app.post('/api/generate', async (req, res) => {
    console.log("--- New Request Received ---");
    const uniqueId = `resume-${Date.now()}`;
    const texFilePath = path.join(tmpDir, `${uniqueId}.tex`);

    try {
        const { instructions, resumeText } = req.body;
        if (!instructions || !resumeText) {
            return res.status(400).json({ error: "Missing instructions or resume text." });
        }
        console.log("Step 1: Received instructions and resume text.");

        const prompt = `${systemPrompt}\n\n## User's Instructions:\n${instructions}\n\n## User's Current Resume Text:\n${resumeText}`;
        console.log("Step 2: Sending prompt to Gemini API.");

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        console.log("Step 3: Received response from Gemini.");

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("AI response did not contain a valid JSON object.");
        }
        const cleanedJsonString = jsonMatch[0];
        const resumeJson = JSON.parse(cleanedJsonString);
        console.log("Step 4: Successfully parsed JSON from AI response.");

        const texCode = generateTex(resumeJson);
        console.log("Step 5: Generated .tex code from JSON.");
        fs.writeFileSync(texFilePath, texCode);
        console.log(`Step 6: Wrote .tex file to ${texFilePath}`);

        const pdflatexPath = process.env.PDFLATEX_PATH || 'pdflatex';
        const command = `${pdflatexPath} -interaction=nonstopmode -output-directory=${publicDir} -jobname=${uniqueId} ${texFilePath}`;
        console.log(`Step 7: Executing command: ${command}`);

        await new Promise((resolve, reject) => {
            exec(command, { timeout: 25000 }, (error, stdout, stderr) => {
                if (error) {
                    const logFilePath = path.join(publicDir, `${uniqueId}.log`);
                    let logContent = 'Could not read log file.';
                    if (fs.existsSync(logFilePath)) {
                        logContent = fs.readFileSync(logFilePath, 'utf8');
                    }
                    console.error(`exec error: ${error.message}`);
                    const detailedError = `LaTeX compilation failed. The AI may have generated invalid code. Please check the .tex output. \n\n--- LaTeX Log ---\n${logContent}`;
                    return reject(new Error(detailedError));
                }
                console.log(`Step 8: pdflatex command executed successfully.`);
                if(stderr){
                    console.warn(`pdflatex stderr (warnings): ${stderr}`);
                }
                resolve(stdout);
            });
        });

        const pdfUrl = `/public/${uniqueId}.pdf`;
        console.log(`Step 9: PDF generated. URL: ${pdfUrl}`);
        
        res.json({ tex: texCode, pdfUrl: pdfUrl });

    } catch (error) {
        console.error("--- Request Failed ---");
        console.error("Error processing generation request:", error);
        res.status(500).json({ error: error.message || "An internal server error occurred." });
    } finally {
        const extensionsToDelete = ['.tex', '.aux', '.log'];
        extensionsToDelete.forEach(ext => {
            const tempFile = path.join(tmpDir, `${uniqueId}${ext}`);
            if(fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            
            const publicFile = path.join(publicDir, `${uniqueId}${ext}`);
            if(fs.existsSync(publicFile)) fs.unlinkSync(publicFile);
        });
        console.log("--- Request Finished & Cleaned Up ---");
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
