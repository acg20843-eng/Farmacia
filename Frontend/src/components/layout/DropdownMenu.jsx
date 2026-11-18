import { useState } from "react";
import { NavLink } from "react-router-dom";

export default function DropdownMenu({ label, items = [] }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {label} {open ? "▲" : "▼"}
      </button>

      {open && (
        <div>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
