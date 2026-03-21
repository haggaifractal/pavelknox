# PavelKnox 🚀

**AI-Powered Knowledge & Operations Management Platform**

PavelKnox is an enterprise-grade, secure, and highly scalable workspace designed specifically to empower small and medium-sized businesses (SMBs). It unites Knowledge Base management, Client CRM, Task tracking, and powerful Retrieval-Augmented Generation (RAG) AI into a single, cohesive Next.js and Firebase ecosystem.

---

## 🌟 The Vision: Empowering Small & Medium Teams
For many small teams, critical knowledge is siloed across Google Drive, Slack channels, and employees' heads. PavelKnox changes the game by acting as a **central nervous system** for your office. It allows teams to institutionalize their knowledge and query it naturally using advanced AI. 

Whether you need to extract clauses from a past contract, onboard a new employee, manage daily client tasks, or **dictate meeting notes on the go via Telegram**, PavelKnox provides big-tech capabilities safely, securely, and cost-effectively.

---

## 💼 Ideal Use Cases & Target Audiences
PavelKnox is highly adaptable, making it perfect for knowledge-intensive environments:

1. **⚖️ Law Firms & Accounting Offices**
   - **Use Case:** Securely index historical case files and dictate post-court summaries directly via Telegram.
   - **Value:** Lawyers can ask the AI for exact contract terms, or record a voice memo while driving back from court, which the system automatically transcribes, reviews, and turns into assignable tasks.

2. **🏢 Real Estate & Property Management**
   - **Use Case:** Manage tenant data and on-site property inspections.
   - **Value:** Agents walking through a property can send a voice note to the Telegram Bot. The AI transcribes the issues, creates a "Draft" report for review, and automatically opens maintenance tasks assigned to the logistics department.

3. **🚀 Tech Startups & Agencies**
   - **Use Case:** Internal engineering wikis, HR onboarding, and agile task generation.
   - **Value:** Reduces onboarding time drastically. Product managers can dump feature ideas into the secure Telegram bot, and the AI will auto-generate developer tasks.

4. **🤝 Consulting & Boutique Firms**
   - **Use Case:** Centralizing client dossiers and meeting summaries.
   - **Value:** Consultants can track tasks per client and instantly retrieve insights from previous consulting engagements using the RAG agent.

---

## 🔥 Key Features

### 🎙️ AI-Powered Telegram Integration (Voice-to-Task)
- **On-the-Go Dictation:** Interact with the system from anywhere via a dedicated Telegram bot. Send voice messages or text, and the system automatically transcribes and structures them into Drafts.
- **Human-in-the-Loop Review:** The system generates a direct edit link and sends it back to the creator (or a team reviewer). Nothing is published to the Knowledge Base without human verification.
- **Automated Task Extraction:** An advanced AI model analyzes the incoming Telegram data, extracts actionable items, and automatically generates Tasks, allowing assignment to specific departments or employees.
- **Strict Security & ID Whitelisting:** Zero public access. The Telegram bot will *only* respond to specific Telegram User IDs that have been explicitly whitelisted by the System Administrator.

### 🤖 The Internal Guide Agent (Core AI Helpdesk)
One of the most powerful features of the system: a dedicated AI Internal Guide trained extensively on the application’s structure and organizational topology.
- **Department-Aware Context:** During the Draft/Review stage, every document can be explicitly assigned to the entire company or restricted to a specific department. The AI dynamically respects these associations based on the logged-in user's role—preventing irrelevant information overload and ensuring absolute data compartmentalization.
- **Smart Token & Budget Management:** To prevent unnecessary API costs ("token burn"), the agent is programmed to be hyper-efficient. It avoids massive blind queries by proactively asking the user clarifying questions and demanding specific inputs *before* deciding to pull large context windows from the database.
- **Interactive Navigation:** Guides employees step-by-step on how to perform specific actions, submit forms, or find data within the platform.

### 🧠 Intelligent RAG Knowledge Ecosystem
- **The Knowledge Oracle:** Interact with an AI that intimately knows your business data. It strictly respects document status, relying *only* on verified, published company data (ignoring Drafts completely).
- **Enterprise Model Flexibility:** Seamlessly utilizes state-of-the-art models including **Azure OpenAI** (for strict corporate compliance), standard OpenAI (GPT-4o, GPT-4o-mini), and Google Gemini Flash-Lite.

### 👥 Client & Task Management
- **Integrated CRM:** Manage clients with ease, including inline editing, bulk deletions, and robust CSV imports with data validation previews.
- **Task Tracking:** Link tasks directly to clients and knowledge base items. If a knowledge item is deleted, the system intelligently handles associated tasks with secure warning prompts.

### 🛡️ Enterprise-Grade Security & Roles
- **Granular Permissions:** Strict role-based access control (User, Admin, Super Admin).
- **Audit Logs:** Complete transparency with an immutable audit log of administrative actions, edits, and deletions.
- **Data Integrity:** Solid safeguards against accidental data deletion (e.g., warning prompts before deleting active tasks/drafts).

### 📊 Cost Tracking & Administration
- **Token Analytics:** Monitor AI costs in real-time. The Admin dashboard breaks down input/output tokens and USD costs per user and per model, preventing budget blowouts.
- **System Constraints:** Built-in safeguards like text character limits and capacity constraints optimized for database stability and predictable Firestore billing.

### 🌍 Global Ready (Multilingual & Themes)
- Built-in Internationalization (i18n) with full Right-to-Left (RTL) support (English/Hebrew out of the box).
- Sleek Dark / Light mode UI using Tailwind CSS 4.

---

## 🛠️ Technology Stack
- **Frontend Framework:** Next.js 15 (App Router), React 19
- **Styling & UI:** Tailwind CSS v4, Framer Motion, Lucide Icons
- **Backend & Database:** Firebase (Firestore, Auth, Admin SDK)
- **AI Integration:** `@google/genai`, `openai` SDK, Telegram Bot API
- **Language:** TypeScript

---

## 🚀 Getting Started

1. **Clone the repository.**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up Environment Variables:**
   Create a `.env.local` file with your Firebase, OpenAI, Google GenAI credentials, and Telegram Bot token.
4. **Run the development server:**
   ```bash
   npm run dev
   ```
5. **Open** [http://localhost:3000](http://localhost:3000) in your browser.

---

*Built for teams who want to move fast, stay organized, and leverage the full power of Artificial Intelligence securely.*
