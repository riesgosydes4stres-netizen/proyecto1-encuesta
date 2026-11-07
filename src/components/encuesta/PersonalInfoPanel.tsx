import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  DOCUMENT_TYPES,
  LIMITS,
  cleanPersonalInfo,
  getPersonalInfo,
  savePersonalInfo,
  type PersonalInfo,
} from "@/lib/profile";

const docLabel = (v: string) => DOCUMENT_TYPES.find((d) => d.value === v)?.label ?? v;

export function PersonalInfoPanel() {
  const { user, setProfileName } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState("");
  const key = ["personal-info", user?.id];

  const info = useQuery({ queryKey: key, queryFn: () => getPersonalInfo(user!.id), enabled: !!user });

  const save = useMutation({
    mutationFn: (data: PersonalInfo) => savePersonalInfo(user!.id, data),
    onSuccess: (_r, data) => {
      qc.setQueryData(key, data);
      setProfileName(data.name);
      setEditing(false);
      toast("Información personal guardada.");
    },
    onError: () => setErr("No se pudo guardar. Intente de nuevo."),
  });

  if (!user) return null;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr("");
    const f = new FormData(e.currentTarget);
    const { info: clean, error } = cleanPersonalInfo(Object.fromEntries(f.entries()));
    if (error) return setErr(error);
    save.mutate(clean);
  };

  const d = info.data;

  if (info.isLoading) return <p className="pi-note">Cargando su información…</p>;
  if (info.isError || !d) return <p className="err" role="alert">No se pudo cargar su información personal.</p>;

  if (!editing) {
    const rows: [string, string][] = [
      ["Nombre completo", d.name],
      ["Documento", d.document_number ? `${docLabel(d.document_type)} · ${d.document_number}` : ""],
      ["Correo", user.email ?? ""],
      ["Teléfono", d.phone],
      ["Cargo o rol", d.position],
      ["Entidad o dependencia", d.organization],
      ["Municipio o zona de trabajo", d.municipality],
    ];
    const missing = rows.filter(([, v]) => !v).length;
    return (
      <div className="pi">
        <h3>Información personal</h3>
        <dl>
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd className={v ? "" : "none"}>{v || "Sin registrar"}</dd>
            </div>
          ))}
        </dl>
        {missing > 0 && <p className="pi-note">Complete sus datos para identificarse como responsable de las encuestas.</p>}
        <button className="btn ghost" type="button" onClick={() => { setErr(""); setEditing(true); }}>
          Editar información personal
        </button>
      </div>
    );
  }

  return (
    <form className="pi" onSubmit={onSubmit} noValidate>
      <h3>Editar información personal</h3>
      <label>
        Nombre completo
        <input name="name" autoComplete="name" defaultValue={d.name} maxLength={LIMITS.name} required />
      </label>
      <div className="pi-row">
        <label>
          Tipo de documento
          <select name="document_type" defaultValue={d.document_type}>
            <option value="">Elegir…</option>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label>
          Número
          <input name="document_number" inputMode="numeric" defaultValue={d.document_number} maxLength={LIMITS.document_number} />
        </label>
      </div>
      <label>
        Teléfono o celular
        <input name="phone" type="tel" autoComplete="tel" defaultValue={d.phone} maxLength={LIMITS.phone} placeholder="300 123 4567" />
      </label>
      <label>
        Cargo o rol
        <input name="position" autoComplete="organization-title" defaultValue={d.position} maxLength={LIMITS.position} placeholder="Ej.: Profesional social de campo" />
      </label>
      <label>
        Entidad o dependencia
        <input name="organization" autoComplete="organization" defaultValue={d.organization} maxLength={LIMITS.organization} placeholder="Ej.: UNGRD · Subdirección de Reducción" />
      </label>
      <label>
        Municipio o zona de trabajo
        <input name="municipality" defaultValue={d.municipality} maxLength={LIMITS.municipality} placeholder="Ej.: Paratebueno, Cundinamarca" />
      </label>
      <p className="pi-note">Su correo ({user.email}) no se puede cambiar aquí. Solo usted ve estos datos.</p>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn gold" type="submit" disabled={save.isPending}>
        {save.isPending ? "Guardando…" : "Guardar cambios"}
      </button>
      <button className="linkish" type="button" onClick={() => { setErr(""); setEditing(false); }}>
        Cancelar
      </button>
    </form>
  );
}
