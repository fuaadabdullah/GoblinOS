#!/usr/bin/env python3
"""
Audit Log Query API for GoblinOS Telemetry

Provides REST API for querying, searching, and filtering audit events.
Supports pagination, time ranges, and complex filters.
"""

import json
import gzip
from http.server import BaseHTTPRequestHandler, HTTPServer
import os
import urllib.parse
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Any
import argparse


class AuditQueryAPI:
    def __init__(self, log_dir: str = 'audit_logs'):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)

    def get_log_files(self) -> List[Path]:
        """Get all audit log files (including compressed)"""
        return list(self.log_dir.glob('audit_events*.jsonl*'))

    def parse_log_entry(self, line: str) -> Optional[Dict]:
        """Parse a single audit log entry"""
        try:
            return json.loads(line.strip())
        except json.JSONDecodeError:
            return None

    def read_log_file(self, file_path: Path) -> List[Dict]:
        """Read all entries from a log file"""
        entries = []

        try:
            if file_path.suffix == '.gz':
                with gzip.open(file_path, 'rt') as f:
                    for line in f:
                        entry = self.parse_log_entry(line)
                        if entry:
                            entries.append(entry)
            else:
                with file_path.open('r') as f:
                    for line in f:
                        entry = self.parse_log_entry(line)
                        if entry:
                            entries.append(entry)
        except Exception as e:
            print(f"Error reading {file_path}: {e}")

        return entries

    def get_entry_timestamp(self, entry: Dict) -> Optional[datetime]:
        """Extract timestamp from audit entry"""
        timestamp_fields = ['timestamp', 'occurred_at', 'created_at', 'event_time']

        for field in timestamp_fields:
            if field in entry:
                timestamp_str = entry[field]
                try:
                    if 'T' in timestamp_str:
                        return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    else:
                        return datetime.fromtimestamp(float(timestamp_str))
                except (ValueError, TypeError):
                    continue

        return None

    def matches_filter(self, entry: Dict, filters: Dict[str, Any]) -> bool:
        """Check if an entry matches the given filters"""
        for key, value in filters.items():
            if key not in entry:
                return False

            entry_value = entry[key]

            # Handle different filter types
            if isinstance(value, dict):
                # Range filter: {"gte": 123, "lte": 456}
                if 'gte' in value and entry_value < value['gte']:
                    return False
                if 'lte' in value and entry_value > value['lte']:
                    return False
                if 'gt' in value and entry_value <= value['gt']:
                    return False
                if 'lt' in value and entry_value >= value['lt']:
                    return False
            elif isinstance(value, list):
                # List filter: match any value in list
                if entry_value not in value:
                    return False
            else:
                # Exact match
                if entry_value != value:
                    return False

        return True

    def search_entries(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """Search audit entries with given query parameters"""
        # Parse query parameters
        filters = {}
        time_range = {}
        limit = int(query.get('limit', [100])[0])
        offset = int(query.get('offset', [0])[0])
        sort_by = query.get('sort_by', ['timestamp'])[0]
        sort_order = query.get('sort_order', ['desc'])[0]

        # Extract filters
        for key, values in query.items():
            if key in ['limit', 'offset', 'sort_by', 'sort_order', 'from', 'to']:
                continue

            # Handle single values vs lists
            value = values[0] if len(values) == 1 else values

            # Try to parse as JSON for complex filters
            if isinstance(value, str):
                try:
                    value = json.loads(value)
                except json.JSONDecodeError:
                    pass

            filters[key] = value

        # Handle time range
        if 'from' in query:
            try:
                time_range['gte'] = datetime.fromisoformat(query['from'][0].replace('Z', '+00:00'))
            except ValueError:
                pass

        if 'to' in query:
            try:
                time_range['lte'] = datetime.fromisoformat(query['to'][0].replace('Z', '+00:00'))
            except ValueError:
                pass

        # Collect all matching entries
        all_entries = []
        log_files = self.get_log_files()

        for file_path in log_files:
            entries = self.read_log_file(file_path)
            for entry in entries:
                # Apply time range filter
                if time_range:
                    entry_ts = self.get_entry_timestamp(entry)
                    if not entry_ts:
                        continue
                    if 'gte' in time_range and entry_ts < time_range['gte']:
                        continue
                    if 'lte' in time_range and entry_ts > time_range['lte']:
                        continue

                # Apply other filters
                if self.matches_filter(entry, filters):
                    all_entries.append(entry)

        # Sort entries
        if sort_by and all_entries:
            reverse = sort_order.lower() == 'desc'
            if sort_by == 'timestamp':
                all_entries.sort(key=lambda x: self.get_entry_timestamp(x) or datetime.min, reverse=reverse)
            else:
                all_entries.sort(key=lambda x: x.get(sort_by, ''), reverse=reverse)

        # Apply pagination
        total = len(all_entries)
        paginated_entries = all_entries[offset:offset + limit]

        return {
            'entries': paginated_entries,
            'total': total,
            'limit': limit,
            'offset': offset,
            'has_more': offset + limit < total
        }


class QueryHandler(BaseHTTPRequestHandler):
    def __init__(self, *args, api=None, **kwargs):
        self.api = api or AuditQueryAPI()
        super().__init__(*args, **kwargs)

    def do_GET(self):
        """Handle GET requests for querying audit logs"""
        try:
            # Parse URL and query parameters
            parsed_url = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed_url.query)

            if parsed_url.path == '/query':
                # Search query
                result = self.api.search_entries(query_params)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())

            elif parsed_url.path == '/stats':
                # Get statistics
                stats = self.get_stats()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(stats).encode())

            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'Not found')

        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def get_stats(self) -> Dict:
        """Get audit log statistics"""
        log_files = self.api.get_log_files()
        total_size = 0
        total_entries = 0
        oldest_entry = None
        newest_entry = None

        for file_path in log_files:
            total_size += file_path.stat().st_size

            entries = self.api.read_log_file(file_path)
            total_entries += len(entries)

            for entry in entries:
                entry_ts = self.api.get_entry_timestamp(entry)
                if entry_ts:
                    if not oldest_entry or entry_ts < oldest_entry:
                        oldest_entry = entry_ts
                    if not newest_entry or entry_ts > newest_entry:
                        newest_entry = entry_ts

        return {
            'total_files': len(log_files),
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'total_entries': total_entries,
            'oldest_entry': oldest_entry.isoformat() if oldest_entry else None,
            'newest_entry': newest_entry.isoformat() if newest_entry else None
        }

    def log_message(self, format, *args):
        """Override to reduce noise"""
        pass


def main():
    """CLI interface for audit query API"""
    parser = argparse.ArgumentParser(description='GoblinOS Audit Query API')
    parser.add_argument('--port', type=int, default=8002, help='Port to run the API server')
    parser.add_argument('--log-dir', default='audit_logs', help='Audit log directory')

    args = parser.parse_args()

    api = AuditQueryAPI(args.log_dir)

    def handler_class(*handler_args, **handler_kwargs):
        return QueryHandler(*handler_args, api=api, **handler_kwargs)

    server = HTTPServer(('0.0.0.0', args.port), handler_class)
    print(f'Audit Query API listening on port {args.port}')
    print(f'Log directory: {args.log_dir}')
    print(f'Endpoints:')
    print(f'  GET /query?actor=user&action=login&limit=10')
    print(f'  GET /stats')

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down...')
        server.shutdown()


if __name__ == '__main__':
    main()
