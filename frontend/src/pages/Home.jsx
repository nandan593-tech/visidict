import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  BellRing,
  LayoutDashboard,
  History,
  ArrowRight,
  Cpu,
  Radio,
  Send,
  ShieldCheck,
  Video,
} from 'lucide-react';
import Intro from '../components/Intro';
import './Home.css';

export default function Home() {
  const [introDone, setIntroDone] = useState(() => {
    return sessionStorage.getItem('visidict_home_intro_done') === 'true';
  });

  const handleIntroComplete = () => {
    sessionStorage.setItem('visidict_home_intro_done', 'true');
    setIntroDone(true);
  };

  const scrollToHowItWorks = (e) => {
    e.preventDefault();
    const element = document.getElementById('how-it-works');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const featureCards = [
    {
      icon: <Camera size={28} className="feature-icon" />,
      title: 'Live Detection',
      description:
        'YOLOv8 identifies presence in real time from any webcam or IP camera feed.',
    },
    {
      icon: <BellRing size={28} className="feature-icon" />,
      title: 'Instant Alerts',
      description:
        'Absences trigger automatic WhatsApp, email, and phone call notifications via n8n.',
    },
    {
      icon: <LayoutDashboard size={28} className="feature-icon" />,
      title: 'Live Dashboard',
      description:
        'Watch attendance update the moment it happens, with confidence scores per detection.',
    },
    {
      icon: <History size={28} className="feature-icon" />,
      title: 'Full History',
      description:
        'Every detection and alert is logged — filter by employee, date, or status, and export to PDF.',
    },
  ];

  const workflowSteps = [
    {
      step: '1',
      icon: <Video size={22} />,
      title: 'Camera captures feed',
      description: 'Continuous real-time frame ingestion from connected devices',
    },
    {
      step: '2',
      icon: <Cpu size={22} />,
      title: 'AI detects presence',
      description: 'YOLOv8 neural network analyzes visual frames with high accuracy',
    },
    {
      step: '3',
      icon: <Radio size={22} />,
      title: 'Backend logs & broadcasts',
      description: 'Instant state persistence and WebSocket live updates to clients',
    },
    {
      step: '4',
      icon: <Send size={22} />,
      title: 'Alerts fire automatically',
      description: 'Multi-channel automation triggers immediately on absence',
    },
  ];

  const techStack = [
    'YOLOv8',
    'OpenCV',
    'Node.js',
    'Socket.IO',
    'React',
    'SQLite',
    'n8n',
    'Twilio',
  ];

  return (
    <>
      {!introDone && <Intro onComplete={handleIntroComplete} />}
      <div className="home-page">
      {/* Background Decorative Glows */}
      <div className="home-glow-1" />
      <div className="home-glow-2" />
      <div className="home-glow-3" />

      {/* Top Navigation Bar */}
      <header className="home-nav">
        <div className="home-nav-container">
          <div className="home-nav-brand">
            <div className="brand-logo-icon">
              <ShieldCheck size={22} color="var(--color-primary)" />
            </div>
            <span className="brand-title">
              <span className="brand-visi">VISI</span>
              <span className="brand-dict">DICT</span>
            </span>
          </div>
          <div className="home-nav-actions">
            <Link to="/login" className="home-nav-login-btn">
              <span>Sign In</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      <main className="home-content">
        {/* Section 1: Hero Section */}
        <section className="hero-section">
          <div className="hero-badge">
            <span className="hero-badge-pulse" />
            <span>Autonomous Presence Intelligence</span>
          </div>

          <h1 className="hero-wordmark">
            <span className="brand-visi">VISI</span>
            <span className="brand-dict">DICT</span>
          </h1>

          <p className="hero-tagline">
            AI-powered presence detection that watches attendance, so you don't have to.
          </p>

          <p className="hero-subtext">
            Seamless real-time computer vision monitoring with automated multi-channel alert
            orchestration for modern workplaces and secure facilities.
          </p>

          <div className="hero-cta-group">
            <Link to="/login" className="btn-primary-cta">
              <span>Enter Dashboard</span>
              <ArrowRight size={18} />
            </Link>
            <a href="#how-it-works" onClick={scrollToHowItWorks} className="btn-ghost-cta">
              <span>How it works</span>
            </a>
          </div>
        </section>

        {/* Section 2: Feature Cards Grid */}
        <section className="features-section">
          <div className="section-header">
            <h2 className="section-title">Core Capabilities</h2>
            <p className="section-subtitle">
              Engineered for precision, instant feedback, and enterprise reliability
            </p>
          </div>

          <div className="features-grid">
            {featureCards.map((feature, index) => (
              <div key={index} className="glass-panel feature-card">
                <div className="feature-icon-wrapper">{feature.icon}</div>
                <h3 className="feature-card-title">{feature.title}</h3>
                <p className="feature-card-desc">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: "How it works" 4-step Strip */}
        <section id="how-it-works" className="workflow-section">
          <div className="section-header">
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">
              From camera lens to automated escalation in under a second
            </p>
          </div>

          <div className="glass-panel workflow-panel">
            <div className="workflow-steps-strip">
              {workflowSteps.map((stepItem, index) => (
                <div key={stepItem.step} className="workflow-step-item">
                  <div className="step-badge-row">
                    <span className="step-number">{stepItem.step}</span>
                    <div className="step-icon-bubble">{stepItem.icon}</div>
                  </div>
                  <h4 className="step-title">{stepItem.title}</h4>
                  <p className="step-desc">{stepItem.description}</p>
                  {index < workflowSteps.length - 1 && <div className="step-connector" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4: Tech Stack Strip */}
        <section className="tech-stack-section">
          <div className="tech-stack-container">
            <span className="tech-stack-label">BUILT WITH INDUSTRY-LEADING TECH</span>
            <div className="tech-stack-row">
              {techStack.map((tech) => (
                <span key={tech} className="tech-stack-badge">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Section 5: Footer */}
      <footer className="home-footer">
        <div className="footer-container">
          <div className="footer-left">
            <p className="footer-brand-text">
              VISIDICT — Employee Presence & Attendance System
            </p>
            <p className="footer-sub-text">
              Automated Computer Vision & Event-Driven Notification Engine
            </p>
          </div>
          <div className="footer-right">
            {/* Editable student/institution placeholder info */}
            <p className="footer-credit">
              Developed by <span className="credit-highlight">VISIDICT Team</span> · <span className="credit-highlight">Final Year Project</span> · 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}
