# iNote
**A simple note-taking application for university students.**

## Table of Contents
1. [Project Overview](#project-overview)
2. [Team Members](#team-members)
3. [Topic Explanation](#topic-explanation)
4. [Features](#features)
5. [Roadmap](#roadmap)
6. [Setup Instructions](#setup-instructions)


## Project Overview
iNote is a lightweight and user-friendly note-taking application designed to help students organize their notes efficiently. The app allows users to create, edit, and manage notes easily in a structured way.

## Team Members
- **Ramazan Kozhabek**  
 

## Topic Explanation
The project focuses on the development of a digital note-taking system. The main goal is to provide students with a platform where they can store, manage, and quickly access their notes for different subjects. 

## Features
- Create, edit, and delete notes  
- Organize notes by categories or subjects  
- Search notes by title or content  
- User-friendly interface  

## Added routes:
- /about
- /contact

## Assignment 2 Part 1 update:
- /search?name query parameter
- /task/:id route parameter id
- /api/info project information in json format

## Assignment 2 Part 2 update:
- Dababase used:SQLite
- Table contains:title,text
- routes:/tasks;/tasks/:id;post(/tasks);put(/tasks/:id);delete(/tasks/:id)

## Assignment 4
- deployment link :[link](https://inote-production.up.railway.app/)


## Form details
- Form contains:
    - -name;
    - -email;
    - -message

## Roadmap
- **Phase 1:** Project setup 
- **Phase 2:** Form page + POST route
- **Phase 3:** Connect database  
- **Phase 4:** GET/PUT/DELETE CRUD routes  
- **Phase 5:** API testing + error handling
- **Phase 6:** Optional features like auth/search
- **Phase 7:** Final cleanup

# Setup-instructions

## Prerequisites
- Node.js (v16+ recommended)
- npm (comes with Node.js)
Check versions:
node -v
npm -v

## Download or Clone
git clone <repository-url>
cd <project-folder>
(or download ZIP and extract)

## Install Dependencies
npm install

## Run the Server
node server.js

## Open in Browser
http://localhost:3000

## Done
Your Express app is now running.
