

def read_file(filename):
    with open(filename, 'r') as f:  # Dangerous open call
        return f.read()


# SMITHY SECURITY FIX - Fix sast: Potentially dangerous function call
# Applied: 2025-10-26T04:06:19.930949
# Risk Level: medium
# Original Finding: Address security finding: Call to open may be unsafe

# SECURITY FIX: Address sast
# Finding: Call to open may be unsafe
# Severity: medium
# Recommended: Review and implement appropriate security measures

# TODO: Implement security fix for sast
# Consult security best practices and implement proper validation/sanitization

# END SECURITY FIX
