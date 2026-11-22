import { Component, type ReactNode } from 'react';
import { exportBackup } from '../store';

/** If a screen ever crashes, the data is still there: offer a backup and a retry instead of a blank page. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  private async backup() {
    const blob = new Blob([await exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gym-backup-rescue-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page" role="alert">
        <h1>משהו השתבש</h1>
        <p className="muted">הנתונים שלך שמורים במכשיר ולא נמחקו, כולל אימון שבאמצע. כדאי לשמור גיבוי ואז לנסות שוב.</p>
        <button className="btn primary block" onClick={() => void this.backup()}>שמור גיבוי</button>
        <button className="btn ghost block" onClick={() => location.reload()}>נסה שוב</button>
        <p className="muted small" dir="ltr">{this.state.error.message}</p>
      </div>
    );
  }
}
