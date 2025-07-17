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

  // Verificar si el usuario está autenticado al cargar la aplicación
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("https://gestionbim-v6.onrender.com/api/check-auth", {
          credentials: "include", // Incluir cookies para manejar la sesión
        });
  
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated) {
            setUserProfile(data.user);
            setIsAuthenticated(true);
          } else {
            // Si no está autenticado, redirigir al login de Autodesk
            window.location.href = "https://gestionbim-v6.onrender.com/login";
          }
        } else {
          // Si no está autenticado, redirigir al login de Autodesk
          window.location.href = "https://gestionbim-v6.onrender.com/login";
        }
      } catch (error) {
        console.error("Error verificando autenticación:", error);
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
    // Implementar lógica de logout
    window.location.href = "https://gestionbim-v6.onrender.com/logout";
  };

  // Si no está autenticado, mostrar un mensaje de carga
  if (!isAuthenticated) {
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