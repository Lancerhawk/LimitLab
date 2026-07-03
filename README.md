<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Inter&weight=800&size=40&duration=3000&pause=1000&color=3B82F6&center=true&vCenter=true&width=800&height=100&lines=LimitLab;Under+Construction...;Real-Time+Rate+Limiting" alt="Animated Typing SVG" />
</p>

# LimitLab

![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)
> 🚧 **Under Construction:** LimitLab is currently in active development. Features, database architecture, and APIs are actively being built and are subject to change. 🚧

Real-Time Rate Limiting Playground.

## Overview
LimitLab is an interactive platform where users can configure, simulate, visualize, and compare different rate limiting algorithms in real time, such as Token Bucket, Fixed Window, and Sliding Window.

## Features
- **Token Bucket Algorithm:** Production-grade PostgreSQL and high-performance In-Memory implementations. Features accurate fractional token refill, Optimistic Concurrency Control (OCC) for race conditions, and real-time frontend visualization.
- **Fixed Window Algorithm:** PostgreSQL and In-Memory implementations bound to absolute system clock time boundaries. Includes strict window resets, live UI progress bars, and authentic single-client load testing.

## Tech Stack
**Frontend:** React, TypeScript, Vite, Tailwind CSS (v4), React Router, Socket.IO Client
**Backend:** Node.js, Express.js, TypeScript, Prisma ORM, Supabase PostgreSQL, Socket.IO

## Monorepo Structure
- `/frontend` - React application
- `/backend` - Express.js REST and WebSocket server
- `/docs` - Documentation
- `/docker` - Docker configuration

## Installation & Development (See Below for setup)
