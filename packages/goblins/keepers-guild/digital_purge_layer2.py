import os
import json
import pickle
import webbrowser
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# --- Configuration ---

# The scopes our script needs. To list and manage third-party app links.
# This is a sensitive scope, so the user will be explicitly asked for consent.
SCOPES = [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/plus.me",
    "https://www.googleapis.com/auth/accounts.reauth",
]

INPUT_REPORT_FILE = "digital_purge_report.json"
LOG_FILE = "digital_purge_revocation_log.json"

# --- Google API Functions ---


def get_google_credentials():
    """
    Gets user credentials for the Google API using an OAuth 2.0 flow.
    Stores credentials for subsequent runs.
    """
    creds = None
    # The file token.pickle stores the user's access and refresh tokens.
    if os.path.exists("token.pickle"):
        with open("token.pickle", "rb") as token:
            creds = pickle.load(token)

    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # IMPORTANT: You must create a credentials.json file from the Google Cloud Console
            # for an "Desktop app" OAuth 2.0 client.
            if not os.path.exists("credentials.json"):
                raise FileNotFoundError(
                    "ERROR: 'credentials.json' not found. "
                    "Please download it from your Google Cloud Console and place it in this directory."
                )
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)

        # Save the credentials for the next run
        with open("token.pickle", "wb") as token:
            pickle.dump(creds, token)
    return creds


def revoke_google_access(service_name, log_entries):
    """
    Attempts to revoke Google OAuth access.
    As direct third-party revocation is not API-supported, this function
    provides the user with the direct link to manage permissions.
    """
    print(f"\n[Google] Action required for: {service_name}")
    print(
        "The Google API does not allow one app to revoke another's access for security reasons."
    )
    print("You must manually review and remove access.")

    permissions_url = "https://myaccount.google.com/permissions"
    print(f"Opening the Google Account permissions page: {permissions_url}")

    try:
        webbrowser.open(permissions_url, new=2)
        message = f"Opened browser for manual revocation of '{service_name}'. Please find the app in the list and remove its access."
        status = "manual_action_required"
    except Exception as e:
        message = f"Could not open browser. Please manually visit {permissions_url} to revoke access for '{service_name}'."
        status = "error"
        print(f"Error: {e}")

    log_entries.append(
        {
            "provider": "Google",
            "service": service_name,
            "status": status,
            "message": message,
        }
    )


# --- Main Orchestration ---


def process_report(report):
    """
    Processes the report from Layer 1 and triggers revocation actions.
    """
    accounts = report.get("accounts_detected", [])
    if not accounts:
        print("No accounts detected in the report. Nothing to do.")
        return []

    log_entries = []

    # Filter for accounts that need automatic revocation via Google
    google_oauth_accounts = [
        acc
        for acc in accounts
        if acc.get("oauth") == "Google"
        and "Revoke" in acc.get("recommended_action", "")
    ]

    if google_oauth_accounts:
        print("--- Starting Google OAuth Revocation Process ---")
        try:
            # This step is commented out as the API doesn't support the desired action,
            # but getting credentials would be the first step if it did.
            # creds = get_google_credentials()
            # print("Successfully authenticated with Google.")

            for account in google_oauth_accounts:
                revoke_google_access(account["service"], log_entries)

        except FileNotFoundError as e:
            print(e)
            print("Skipping Google revocation.")
        except Exception as e:
            print(f"An unexpected error occurred during Google processing: {e}")
            log_entries.append(
                {"provider": "Google", "status": "error", "message": str(e)}
            )

    # Placeholder for other providers
    # if apple_accounts: ...
    # if facebook_accounts: ...

    return log_entries


def main():
    """
    Main function to run the OAuth Auto-Revocation script.
    """
    print("\n--- GoblinOS Digital Purge Module: Layer 2 ---")
    if not os.path.exists(INPUT_REPORT_FILE):
        print(f"Error: Input report '{INPUT_REPORT_FILE}' not found.")
        print("Please run Layer 1 (digital_purge.py) first.")
        return

    with open(INPUT_REPORT_FILE, "r") as f:
        report_data = json.load(f)

    revocation_logs = process_report(report_data)

    if revocation_logs:
        with open(LOG_FILE, "w") as f:
            json.dump(revocation_logs, f, indent=2)
        print(f"\n--- Revocation Process Complete ---")
        print(f"Log of actions saved to: {LOG_FILE}")
        print(json.dumps(revocation_logs, indent=2))


if __name__ == "__main__":
    main()
