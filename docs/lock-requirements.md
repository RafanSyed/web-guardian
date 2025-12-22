# Lock Requirements

- This system must require administrator privileges to remove or disable.
- No runtime disable switches are allowed.
- No debug bypass flags are allowed.
- No environment variables may disable filtering.
- No temporary allowlists or “just this once” overrides.
- All configuration files must be owned by admin and read-only to the user.
