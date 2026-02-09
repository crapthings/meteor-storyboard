import { Link } from "react-router";

export const NotFoundPage = () => {
  return (
    <section className="card storyboard-card">
      <h2 className="storyboard-title">Page not found</h2>
      <p className="storyboard-text">
        The page you are looking for does not exist.
      </p>
      <Link className="button" to="/">
        Go back home
      </Link>
    </section>
  );
};
