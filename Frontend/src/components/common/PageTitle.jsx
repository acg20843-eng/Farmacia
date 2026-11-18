export default function PageTitle({ title, description }) {
  return (
    <section>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </section>
  );
}
