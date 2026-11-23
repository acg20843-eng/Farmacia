import { useState } from "react";

export default function useCrudForm(initialValues) {
  const [values, setValues] = useState(() => ({ ...initialValues }));

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function fill(data) {
    setValues({ ...initialValues, ...data });
  }

  function reset() {
    setValues({ ...initialValues });
  }

  return { values, handleChange, fill, reset };
}
