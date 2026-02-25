import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Select,
  MenuItem,
  TextField,
} from "@mui/material";
import type { AppRole } from "../App";

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

const STORAGE_KEY = "quotation_mvp_users_v1";

function loadUsers(): ManagedUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveUsers(users: ManagedUser[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function UserManagement({
  currentRole,
}: {
  onBack: () => void;
  currentRole: AppRole;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [filter, setFilter] = useState("");

  // Simple "invite" inputs (optional but handy for proto)
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("ExternalUser");

  // Load once
  useEffect(() => {
    const existing = loadUsers();

    // If empty, seed with some demo users
    if (existing.length === 0) {
      const seed: ManagedUser[] = [
        { id: "u1", name: "Spencer Collins", email: "spencer@company.com", role: "SuperUser" },
        { id: "u2", name: "Liam Flood", email: "liam@company.com", role: "InternalUser" },
        { id: "u3", name: "Tore Osvold", email: "tore@partner.com", role: "ExternalUser" },
      ];
      setUsers(seed);
      saveUsers(seed);
      return;
    }

    setUsers(existing);
  }, []);

  // Save on change
  useEffect(() => {
    saveUsers(users);
  }, [users]);

  const canEditRoles = currentRole === "SuperUser" || currentRole === "InternalUser";

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, filter]);

  function updateUserRole(id: string, role: AppRole) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
  }

  function removeUser(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  function addUser() {
    const name = newName.trim();
    const email = newEmail.trim();

    if (!name || !email) return;

    // Prevent duplicates by email
    const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) return;

    const next: ManagedUser = { id: makeId(), name, email, role: newRole };
    setUsers((prev) => [...prev, next]);

    setNewName("");
    setNewEmail("");
    setNewRole("ExternalUser");
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0 }}>User Management (Prototype)</h3>
      </div>

      {/* Quick add user (proto invite) */}
      <Paper style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            label="Name"
            size="small"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ minWidth: 200 }}
          />
          <TextField
            label="Email"
            size="small"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ minWidth: 240 }}
          />
          <Select
            size="small"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as AppRole)}
            style={{ minWidth: 160 }}
          >
            <MenuItem value="SuperUser">SuperUser</MenuItem>
            <MenuItem value="InternalUser">InternalUser</MenuItem>
            <MenuItem value="ExternalUser">ExternalUser</MenuItem>
          </Select>

          <Button variant="contained" onClick={addUser} disabled={!canEditRoles}>
            Add user
          </Button>

          {!canEditRoles && (
            <span style={{ opacity: 0.7 }}>(You don’t have permission to edit users.)</span>
          )}
        </div>
      </Paper>

      {/* Filter */}
      <div style={{ marginBottom: 12 }}>
        <TextField
          label="Search users"
          size="small"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: 320 }}
        />
      </div>

      {/* Table */}
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell style={{ width: 240 }}>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell style={{ width: 180 }}>Role</TableCell>
              <TableCell style={{ width: 120 }} />
            </TableRow>
          </TableHead>

          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Select
                    size="small"
                    value={u.role}
                    disabled={!canEditRoles}
                    onChange={(e) => updateUserRole(u.id, e.target.value as AppRole)}
                    style={{ width: 160 }}
                  >
                    <MenuItem value="SuperUser">SuperUser</MenuItem>
                    <MenuItem value="InternalUser">InternalUser</MenuItem>
                    <MenuItem value="ExternalUser">ExternalUser</MenuItem>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => removeUser(u.id)}
                    disabled={!canEditRoles}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} style={{ opacity: 0.7 }}>
                  No users match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </div>
  );
}
