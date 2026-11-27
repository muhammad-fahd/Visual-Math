'use client';

import { Component, type ReactNode } from 'react';

// Catches what the 3D picture can throw while it renders: the chunk failing to download (offline, a
// CDN hiccup) or the graphics context failing to start. The viewer then falls to Tier C with its plain
// message, instead of the whole page showing an error (AD-13, FR-3.14).
export class Boundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
