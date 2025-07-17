import React, { useState, useEffect } from "react";
import ModuleMenu from "./components/ModuleMenu";
import ModuleRouter from "./components/ModuleRouter";
import TopNavigation from "./components/TopNavigation";
import "./components/ModuleRouter.css";

function App() {
  const [selectedProject, setSelectedProject] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeModule, setActiveModule] = useState(null);
  const [loading, setLoading] = useState(true); // 👈 Nuevo estado

  // Verificar si el usuario está autenticado al cargar la aplicación
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("https://gestionbim-v6.onrender.com/api/check-auth", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          if (data.authenticated) {
            setUserProfile(data.user);
            setIsAuthenticated(true);
          } else {
            window.location.href = "https://gestionbim-v6.onrender.com/login";
          }
        } else {
          window.location.href = "https://gestionbim-v6.onrender.com/login";
        }
      } catch (error) {
        console.error("Error verificando autenticación:", error);
        window.location.href = "https://gestionbim-v6.onrender.com/login";
      } finally {
        setLoading(false); // 👈 Marcar como completada la carga
      }
    };

    checkAuth();
  }, []);

  const handleModuleChange = (moduleId) => {
    setActiveModule(moduleId);
  };

  const handleBackToMenu = () => {
    setActiveModule(null);
    setSelectedProject(null);
  };

  const handleLogout = () => {
    window.location.href = "https://gestionbim-v6.onrender.com/logout";
  };

  // 👇 Esperar hasta que termine la verificación de sesión
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#6b7280'
      }}>
        Cargando...
      </div>
    );
  }

  // 👇 Ya se cargó pero no está autenticado, no mostrar nada más (por si acaso)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="app">
      <TopNavigation
        activeModule={activeModule}
        onBackToMenu={handleBackToMenu}
        userProfile={userProfile}
        onLogout={handleLogout}
        showBackButton={activeModule !== null}
      />
      <main className="app-main">
        {activeModule ? (
          <ModuleRouter
            activeModule={activeModule}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
          />
        ) : (
          <ModuleMenu
            activeModule={activeModule}
            onModuleChange={handleModuleChange}
          />
        )}
      </main>
    </div>
  );
}

export default App;
