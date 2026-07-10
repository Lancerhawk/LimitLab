<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Inter&weight=800&size=40&duration=3000&pause=1000&color=3B82F6&center=true&vCenter=true&width=800&height=100&lines=LimitLab;Under+Construction...;Real-Time+Rate+Limiting" alt="Animated Typing SVG" />
</p>

# LimitLab

![Version](https://img.shields.io/badge/version-0.9.0-blue.svg)
> 🚧 **Under Construction:** LimitLab is currently in active development. Features, database architecture, and APIs are actively being built and are subject to change. 🚧

Real-Time Rate Limiting Playground.

## Overview
LimitLab is an interactive platform where users can configure, simulate, visualize, and compare different rate limiting algorithms in real time, such as Token Bucket, Fixed Window, Sliding Window, Sliding Log, and Leaky Bucket.

## Features
- **Interactive Client-Side Simulator:** A deterministic, zero-latency React simulation engine allowing users to visually model Token Bucket and Fixed Window behaviors using drag-and-drop timelines, traffic generators, and side-by-side comparison modes.
- **Token Bucket Algorithm:** Production-grade PostgreSQL and high-performance In-Memory implementations. Features accurate fractional token refill, Optimistic Concurrency Control (OCC) for race conditions, and real-time frontend visualization.
- **Fixed Window Algorithm:** PostgreSQL and In-Memory implementations bound to absolute system clock time boundaries. Includes strict window resets, live UI progress bars, and authentic single-client load testing.
- **Sliding Window Counter:** Smooth rate limiting interpolating previous and current windows.
- **Sliding Log:** Highly accurate, timestamp-based windowing.
- **Leaky Bucket:** Strict traffic policing algorithm queuing requests and processing them at a steady rate.

## Tech Stack
**Frontend:** React, TypeScript, Vite, Tailwind CSS (v4), React Router, Socket.IO Client
**Backend:** Node.js, Express.js, TypeScript, Prisma ORM, Supabase PostgreSQL, Socket.IO

## Monorepo Structure
- `/frontend` - React application
- `/backend` - Express.js REST and WebSocket server
- `/docs` - Documentation
- `/docker` - Docker configuration

## Installation & Development (See Below for setup)
