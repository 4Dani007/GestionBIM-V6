import React, { useState, useEffect } from "react";

function ProjectSearch({ setSelectedProject }) {
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState("");
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Obtener la lista de proyectos desde el backend
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch("https://gestionbim-v6.onrender.com/projects", {
          credentials: "include", // Incluir cookies para manejar la sesión
        });

        if (!response.ok) {
          throw new Error("No se pudieron cargar los proyectos");
        }

        const data = await response.json();
        setProjects(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // Filtrar proyectos basados en la consulta de búsqueda
  useEffect(() => {
    if (query.trim() === "") {
      setFilteredProjects([]);
    } else {
      const results = projects.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredProjects(results);
    }
  }, [query, projects]);

  if (loading) return <div>Cargando proyectos...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ position: "relative", width: "300px" }}>
      <label>Buscar un proyecto:</label>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Escribe un nombre..."
        style={{ width: "100%", padding: "8px", marginTop: "5px" }}
      />

      {filteredProjects.length > 0 && (
        <div
          style={{
            position: "absolute",
            background: "white",
            border: "1px solid #ddd",
            maxHeight: "150px",
            overflowY: "auto",
            width: "100%",
            zIndex: 1000,
          }}
        >
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              style={{
                padding: "8px",
                cursor: "pointer",
                borderBottom: "1px solid #ddd",
              }}
              onClick={() => {
                if (project && project.id && project.name) {
                  setSelectedProject(project);
                  setQuery(project.name);
                  setFilteredProjects([]);
                }
              }}
            >
              {project.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectSearch;