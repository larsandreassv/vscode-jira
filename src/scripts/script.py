from jira import JIRA
import sys
import json

JIRA_SERVER = "https://unimicro.atlassian.net"
JIRA_EMAIL = ""
JIRA_TOKEN = ""

jira_options = {'server': JIRA_SERVER}
jira = JIRA(options=jira_options, basic_auth=(JIRA_EMAIL, JIRA_TOKEN))

def fetch_issues(issue_key, transition_id):

    jira.transitions(issue_key, transition_id)

    print(f"Issue {issue_key} moved to ''")

def update_issue(issue_id, transition_id):
    return

def main():
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == "fetch_issues":
            issues = fetch_issues("BP-992", 71)
            print(json.dumps(issues))
        elif command == "update_issue":
            if len(sys.argv) == 4:
                issue_id = sys.argv[2]
                status = sys.argv[3]
                result = update_issue(issue_id, status)
                print(json.dumps(result))
            else:
                print(json.dumps({"error": "Invalid arguments for update_issue"}))
        else:
            print(json.dumps({"error": "Unknown command"}))
    else:
        print(json.dumps({"error": "No command provided"}))

if __name__ == "__main__":
    main()