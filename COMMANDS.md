# Chattrix Setup & Management Guide

This guide contains the common commands needed to run, maintain, and manage the Chattrix project.

## 1. Running the Application
Open two separate terminal windows for the following:

### Backend
```powershell
cd backend
npm run dev
```

### Frontend
```powershell
cd frontend
npm run dev
```

---

## 2. Dependency Management

### Install Dependencies
Run these if you have just cloned the project:
- **Backend**: `cd backend; npm install`
- **Frontend**: `cd frontend; npm install`

### Clean Node Modules (Windows)
To delete the `node_modules` folders safely:
- **Backend**: `Remove-Item -Recurse -Force backend/node_modules`
- **Frontend**: `Remove-Item -Recurse -Force frontend/node_modules`

---

## 3. Administrative Tasks

### Create Admin / Operator Access
Use the backend CLI to create a new administrative user:
```powershell
cd backend
npm run create-admin
```

---

## 4. Key Configurations
- **Database**: Ensure MySQL is running and configured in `backend/.env`.
- **Styling**: The project uses **Tailwind CSS v4**. Custom styles are located in `frontend/src/index.css`.
