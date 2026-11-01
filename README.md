# Jazan Uni SUC Manager

A lightweight, browser-based schedule planner for Jazan University students. The project helps students upload their academic course pages, extract offered classes, and generate conflict-free timetables without relying on a server-side database or external processing.

## Overview

This tool was built to simplify the process of building a study timetable. Instead of manually checking each course combination, the app helps students:

- upload saved HTML pages from the university academic portal
- select the courses they want to study
- compare available sections and meeting times
- detect time conflicts automatically
- generate the best possible schedule combinations
- prioritize schedules with more free days
- share or export the final timetable

## Main features

- Automatic timetable generation
- Conflict detection between selected courses and sections
- Selection of preferred course sections
- Sorting by number of free days or schedule quality
- Offline-first browser workflow
- Local data processing for privacy
- Shareable schedule links
- Export to image for easy saving or sharing

## Tech stack

- HTML5
- CSS3
- JavaScript
- Client-side logic only

## How it works

1. Open the application in a browser.
2. Upload the saved university course page as an HTML file.
3. Choose the courses and sections you need.
4. Generate the timetable.
5. Review the best available options and export or share the result.

## Why this project is useful

The project is designed for students who want a faster and clearer way to plan their academic schedule. It focuses on practicality, privacy, and simplicity, while keeping everything in the browser so data does not have to be uploaded to a remote server.

## Running locally

Because this is mainly a front-end project, you can run it by opening the app in a browser or serving the folder locally.

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Notes

- This is a student-focused academic utility and not an official university system.
- It is intended as a planning tool for students and should be used with care.
- The app is designed to work locally in the browser and keep user data private.

## License

This project is shared for educational and personal use. Please check the repository for the current license details if one is included.
