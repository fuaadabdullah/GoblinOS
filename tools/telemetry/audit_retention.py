#!/usr/bin/env python3
"""
Audit Log Retention Service for GoblinOS Telemetry

Manages audit log retention, cleanup, and compression.
Supports configurable retention policies and automated maintenance.
"""

import os
import json
import gzip
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional
import argparse


class AuditRetentionService:
    def __init__(self, log_dir: str = 'audit_logs'):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)

        # Configuration from environment
        self.retention_days = int(os.environ.get('AUDIT_RETENTION_DAYS', '90'))
        self.compress_after_days = int(os.environ.get('AUDIT_COMPRESS_AFTER_DAYS', '7'))
        self.max_log_size_mb = int(os.environ.get('AUDIT_MAX_LOG_SIZE_MB', '100'))

    def get_log_files(self) -> List[Path]:
        """Get all audit log files"""
        return list(self.log_dir.glob('audit_events*.jsonl*'))

    def parse_log_entry(self, line: str) -> Optional[Dict]:
        """Parse a single audit log entry"""
        try:
            return json.loads(line.strip())
        except json.JSONDecodeError:
            return None

    def get_entry_timestamp(self, entry: Dict) -> Optional[datetime]:
        """Extract timestamp from audit entry"""
        # Try different timestamp fields
        timestamp_fields = ['timestamp', 'created_at', 'event_time']

        for field in timestamp_fields:
            if field in entry:
                timestamp_str = entry[field]
                try:
                    # Handle ISO format timestamps
                    if 'T' in timestamp_str:
                        return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    else:
                        return datetime.fromtimestamp(float(timestamp_str))
                except (ValueError, TypeError):
                    continue

        return None

    def should_compress_file(self, file_path: Path) -> bool:
        """Check if a file should be compressed"""
        if file_path.suffix == '.gz':
            return False  # Already compressed

        # Compress if older than threshold
        file_age_days = (datetime.now() - datetime.fromtimestamp(file_path.stat().st_mtime)).days
        return file_age_days > self.compress_after_days

    def should_delete_file(self, file_path: Path) -> bool:
        """Check if a file should be deleted based on retention policy"""
        # Check file modification time
        file_age_days = (datetime.now() - datetime.fromtimestamp(file_path.stat().st_mtime)).days
        return file_age_days > self.retention_days

    def compress_file(self, file_path: Path) -> bool:
        """Compress a log file using gzip"""
        if file_path.suffix == '.gz':
            return False  # Already compressed

        compressed_path = file_path.with_suffix(file_path.suffix + '.gz')

        try:
            with file_path.open('rb') as f_in:
                with gzip.open(compressed_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)

            # Remove original file after successful compression
            file_path.unlink()
            print(f"Compressed {file_path} -> {compressed_path}")
            return True

        except Exception as e:
            print(f"Failed to compress {file_path}: {e}")
            # Clean up failed compression
            if compressed_path.exists():
                compressed_path.unlink()
            return False

    def cleanup_old_entries(self, file_path: Path) -> int:
        """Remove old entries from a log file based on retention policy"""
        if file_path.suffix == '.gz':
            return 0  # Don't modify compressed files

        cutoff_date = datetime.now() - timedelta(days=self.retention_days)
        kept_entries = []
        removed_count = 0

        try:
            with file_path.open('r') as f:
                for line_num, line in enumerate(f, 1):
                    entry = self.parse_log_entry(line)
                    if not entry:
                        continue  # Skip malformed entries

                    entry_timestamp = self.get_entry_timestamp(entry)
                    if entry_timestamp and entry_timestamp > cutoff_date:
                        kept_entries.append(line)
                    else:
                        removed_count += 1

            # Rewrite file with only kept entries
            if removed_count > 0:
                with file_path.open('w') as f:
                    f.writelines(kept_entries)
                print(f"Cleaned up {removed_count} old entries from {file_path}")

        except Exception as e:
            print(f"Failed to cleanup {file_path}: {e}")

        return removed_count

    def rotate_log_file(self) -> Optional[Path]:
        """Rotate the current log file if it exceeds size limit"""
        current_log = self.log_dir / 'audit_events.jsonl'

        if not current_log.exists():
            return None

        # Check file size
        size_mb = current_log.stat().st_size / (1024 * 1024)
        if size_mb < self.max_log_size_mb:
            return None

        # Create rotated filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        rotated_name = f'audit_events_{timestamp}.jsonl'
        rotated_path = self.log_dir / rotated_name

        # Rotate the file
        current_log.rename(rotated_path)
        print(f"Rotated log file: {current_log} -> {rotated_path}")

        return rotated_path

    def run_maintenance(self) -> Dict[str, int]:
        """Run full maintenance cycle"""
        stats = {
            'files_compressed': 0,
            'files_deleted': 0,
            'entries_cleaned': 0,
            'files_rotated': 0
        }

        # First, rotate if needed
        rotated_file = self.rotate_log_file()
        if rotated_file:
            stats['files_rotated'] = 1

        # Get all log files
        log_files = self.get_log_files()

        for file_path in log_files:
            # Clean up old entries in uncompressed files
            if file_path.suffix != '.gz':
                cleaned = self.cleanup_old_entries(file_path)
                stats['entries_cleaned'] += cleaned

            # Compress old files
            if self.should_compress_file(file_path):
                if self.compress_file(file_path):
                    stats['files_compressed'] += 1

            # Delete very old files
            if self.should_delete_file(file_path):
                try:
                    file_path.unlink()
                    stats['files_deleted'] += 1
                    print(f"Deleted old log file: {file_path}")
                except Exception as e:
                    print(f"Failed to delete {file_path}: {e}")

        return stats

    def get_stats(self) -> Dict:
        """Get current audit log statistics"""
        log_files = self.get_log_files()
        total_size = 0
        total_entries = 0
        oldest_entry = None
        newest_entry = None

        for file_path in log_files:
            # Get file size
            total_size += file_path.stat().st_size

            # Count entries (skip compressed files for performance)
            if file_path.suffix != '.gz':
                try:
                    with file_path.open('r') as f:
                        for line in f:
                            entry = self.parse_log_entry(line)
                            if entry:
                                total_entries += 1
                                entry_ts = self.get_entry_timestamp(entry)
                                if entry_ts:
                                    if not oldest_entry or entry_ts < oldest_entry:
                                        oldest_entry = entry_ts
                                    if not newest_entry or entry_ts > newest_entry:
                                        newest_entry = entry_ts
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")

        return {
            'total_files': len(log_files),
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'total_entries': total_entries,
            'oldest_entry': oldest_entry.isoformat() if oldest_entry else None,
            'newest_entry': newest_entry.isoformat() if newest_entry else None,
            'retention_days': self.retention_days,
            'compress_after_days': self.compress_after_days
        }


def main():
    """CLI interface for audit log retention"""
    parser = argparse.ArgumentParser(description='GoblinOS Audit Log Retention Service')
    parser.add_argument('--maintenance', action='store_true', help='Run maintenance cycle')
    parser.add_argument('--stats', action='store_true', help='Show log statistics')
    parser.add_argument('--cleanup-entries', action='store_true', help='Clean up old entries only')
    parser.add_argument('--compress', action='store_true', help='Compress old files only')
    parser.add_argument('--rotate', action='store_true', help='Rotate current log file if needed')
    parser.add_argument('--log-dir', default='audit_logs', help='Audit log directory')

    args = parser.parse_args()

    service = AuditRetentionService(args.log_dir)

    if args.stats:
        stats = service.get_stats()
        print("Audit Log Statistics:")
        print(f"  Total Files: {stats['total_files']}")
        print(f"  Total Size: {stats['total_size_mb']} MB")
        print(f"  Total Entries: {stats['total_entries']}")
        print(f"  Oldest Entry: {stats['oldest_entry'] or 'N/A'}")
        print(f"  Newest Entry: {stats['newest_entry'] or 'N/A'}")
        print(f"  Retention Policy: {stats['retention_days']} days")
        print(f"  Compression After: {stats['compress_after_days']} days")

    elif args.maintenance:
        print("Running audit log maintenance...")
        stats = service.run_maintenance()
        print("Maintenance completed:")
        print(f"  Files compressed: {stats['files_compressed']}")
        print(f"  Files deleted: {stats['files_deleted']}")
        print(f"  Entries cleaned: {stats['entries_cleaned']}")
        print(f"  Files rotated: {stats['files_rotated']}")

    elif args.cleanup_entries:
        print("Cleaning up old entries...")
        total_cleaned = 0
        for file_path in service.get_log_files():
            if file_path.suffix != '.gz':
                cleaned = service.cleanup_old_entries(file_path)
                total_cleaned += cleaned
        print(f"Cleaned up {total_cleaned} old entries")

    elif args.compress:
        print("Compressing old files...")
        compressed = 0
        for file_path in service.get_log_files():
            if service.should_compress_file(file_path):
                if service.compress_file(file_path):
                    compressed += 1
        print(f"Compressed {compressed} files")

    elif args.rotate:
        rotated = service.rotate_log_file()
        if rotated:
            print(f"Rotated log file to: {rotated}")
        else:
            print("Log rotation not needed")


if __name__ == '__main__':
    main()
