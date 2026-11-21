import { NavLink } from "react-router-dom";

export default function DropdownMenu({ label, items = [], open, onToggle, onClose }) {
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
      >
        {label} {open ? "▲" : "▼"}
      </button>

      {open && (
        <div>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
