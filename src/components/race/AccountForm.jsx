import { useState } from "react";
import { Alert, Button, FormField, Input, Select } from "../ui";
import { createTeam, registerIndividual } from "../../utils/raceApi";

/**
 * Creates a Carbon Race account for `email` — either a new team (the visitor
 * becomes its founding member) or an individual entry. One form for both
 * because they differ only in wording and the extra "your name" field a team
 * needs to record its founder.
 */
export default function AccountForm({ mode, email, regions, onCreated, onCancel }) {
  const isTeam = mode === "team";
  const [name, setName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [regionId, setRegionId] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(isTeam ? "Enter a team name." : "Enter the name to show on the leaderboard.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const payload = { email, name: trimmed, regionId: regionId === "" ? null : Number(regionId) };
      const result = isTeam
        ? await createTeam({ ...payload, memberName: memberName.trim() })
        : await registerIndividual(payload);
      onCreated({ ...result, name: trimmed, isIndividual: !isTeam });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField
        label={isTeam ? "Team name" : "Name on the leaderboard"}
        required
        helpText={
          isTeam
            ? "This is how your team appears on the leaderboard — a workplace, school, congregation, neighbourhood or family."
            : "Your own name, or whatever you'd like people to see."
        }
      >
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isTeam ? "Ithaca High School" : "Jane Doe"}
          maxLength={200}
          autoFocus
        />
      </FormField>

      {isTeam && (
        <FormField label="Your name" helpText="Optional — recorded as the team's founder.">
          <Input
            type="text"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="Jane Doe"
            maxLength={200}
          />
        </FormField>
      )}

      <FormField label="Region" helpText="Optional — lets people filter the leaderboard by county.">
        <Select value={regionId} onChange={(e) => setRegionId(e.target.value)}>
          <option value="">No region</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </FormField>

      <p className="text-sm text-muted">
        Offsets bought with <span className="font-semibold text-text">{email}</span> can be credited
        to this account at checkout.
      </p>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button type="submit" loading={saving} className="flex-1">
          <span aria-hidden="true" className="material-icons" style={{ fontSize: "20px" }}>
            {isTeam ? "group_add" : "person_add"}
          </span>
          {isTeam ? "Create team" : "Register"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
