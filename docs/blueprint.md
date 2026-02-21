# **App Name**: LeakLens

## Core Features:

- Real-time Dashboard Visualization: Display key market data, overall Integrity Risk Score, and critical analytics through an enterprise-grade dashboard interface.
- Statistical Anomaly Detection & Risk Score Engine: Calculate comprehensive Integrity Risk Scores (0-100) using statistical methods such as rolling statistics, Z-score analysis, order flow imbalance, volume spikes, and rule-based coordination detection.
- Dynamic Probability Time-Series Chart: Visualize probability price over time with overlayed expected drift bands, dynamically highlighting anomaly regions in red to pinpoint suspicious activity.
- Interactive Risk Meter & Breakdown Panels: Present the Integrity Risk Score via a prominent gauge meter, alongside detailed breakdown panels for contributing scores including drift anomaly, order imbalance, volume spike, and coordination.
- Trader Coordination Network Graph: Graphically represent simulated trader activity, identifying and highlighting suspicious clusters to visualize potential coordinated trading behavior.
- Simulate Leak Event Demo Functionality: Provide a user-triggered button to inject simulated abnormal probability drift and coordinated trader activity pre-announcement, showcasing dynamic updates to risk scores and visualizations for live demonstrations.
- Seed Data Management with Firestore: Store and serve deterministic mock prediction market data, including timestamp, probability, volume, and simulated trader IDs, using Google Firestore.

## Style Guidelines:

- Primary color: A sophisticated, vibrant blue (#4093EC), representing data-driven professionalism and reliability within the dark theme.
- Background color: A very dark, subtly desaturated blue-grey (#15181C), providing an immersive dark mode with enhanced focus on data and content.
- Accent color: A light, ethereal aqua (#B4DCE8), used for highlights and interactive elements, providing clear visual contrast against the dark background without appearing as traditional 'teal'.
- Headlines and body font: 'Inter' (grotesque-style sans-serif), chosen for its objective, modern aesthetic, high legibility, and suitability for data-intensive dashboards, matching the professional fintech feel.
- Use simple, functional, line-based icons (e.g., from Lucide or Shadcn UI) to maintain a clean, professional, and clutter-free interface, complementing the minimal design.
- Employ a structured grid layout with distinct card-based sections for various data visualizations and breakdown panels. All cards and primary UI elements will feature generous 2xl rounded corners for a softer, modern enterprise aesthetic.
- Incorporate smooth, subtle animations for state changes, data updates, and transitions to enhance user interaction. Anomaly regions will feature a gentle, pulsating glow to draw attention without being distracting.