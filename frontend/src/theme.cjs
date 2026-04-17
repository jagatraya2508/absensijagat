const fs = require('fs');
const css = fs.readFileSync('index.css', 'utf8');
const overrides = `

/* ========================================
   LIGHT THEME OVERRIDES (RED & WHITE)
======================================== */
:root {
  /* Red Palette */
  --primary-50: #fff1f2;
  --primary-100: #ffe4e6;
  --primary-200: #fecdd3;
  --primary-300: #fda4af;
  --primary-400: #fb7185;
  --primary-500: #f43f5e;
  --primary-600: #e11d48;
  --primary-700: #be123c;
  --primary-800: #9f1239;
  --primary-900: #881337;

  /* Light Background Gradient */
  --gradient-dark: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
  --gradient-primary: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
  
  --shadow-glow: 0 0 20px rgba(244, 63, 94, 0.3);
}

body {
  color: var(--gray-800);
}

.sidebar {
  background: rgba(255, 255, 255, 0.85);
  border-right: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 4px 0 20px rgba(0,0,0,0.03);
}
.sidebar-logo h1, .sidebar-user-name {
  color: var(--gray-800);
}
.sidebar-link {
  color: var(--gray-600);
}
.sidebar-link:hover {
  background: rgba(0, 0, 0, 0.03);
  color: var(--gray-900);
}
.sidebar-link.active {
  background: var(--gradient-primary);
  color: white;
}
.mobile-nav {
  background: rgba(255, 255, 255, 0.95);
  border-top: 1px solid rgba(0,0,0,0.05);
}

.card, .card-glass {
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.6);
}
.card-glass {
  background: rgba(255, 255, 255, 0.85);
}

.card-title, .status-card-content p, .location-info-value {
  color: var(--gray-800);
}
.card-subtitle, .status-card-content h3, .location-info-label {
  color: var(--gray-600);
}

.form-input {
  color: var(--gray-800);
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0,0,0,0.1);
}
.form-input:focus {
  background: white;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.2);
}
.form-label {
  color: var(--gray-700);
}
.form-select {
  background-color: white;
}
.form-select option {
  background-color: white;
  color: var(--gray-800);
}

.table th {
  color: var(--gray-700);
  background: rgba(0,0,0,0.02);
  border-bottom: 1px solid rgba(0,0,0,0.1);
}
.table td {
  color: var(--gray-700);
  border-bottom: 1px solid rgba(0,0,0,0.05);
}
.table tbody tr:hover {
  background: rgba(0, 0, 0, 0.02);
}

.camera-btn {
  border-color: var(--gray-400);
}
.camera-btn:hover {
  background: rgba(0,0,0,0.05);
}

.btn-outline {
  color: var(--primary-600);
  border-color: var(--primary-200);
}
.btn-outline:hover:not(:disabled) {
  background: var(--primary-50);
  border-color: var(--primary-300);
}
`;
fs.writeFileSync('index.css', css + overrides, 'utf8');
console.log('Light theme appended successfully!');
