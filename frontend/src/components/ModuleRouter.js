import React from 'react';
import ProjectSearch from './ProjectSearch';
import FolderTree from './FolderTree';
import UserSearch from './UserSearch';
import ProjectAnalysis from './ProjectAnalysis';
import './ModuleRouter.css';

const ModuleRouter = ({ activeModule, selectedProject, setSelectedProject }) => {
  const renderModule = () => {
    switch (activeModule) {
      case 'Permissions':
        return (
          <div className="module-content">
            <div className="module-header">
              <h2>Validación de Permisos BIM 360/ACC</h2>
              <p>Gestiona y valida permisos en proyectos BIM 360/ACC</p>
            </div>
            <ProjectSearch setSelectedProject={setSelectedProject} />
            {selectedProject && (
              <div style={{ marginTop: "20px" }}>
                <h3>Proyecto seleccionado: {selectedProject.name}</h3>
                <div className="centered-panel">
                  <div className="folder-section">
                    <h4>Estructura de Carpetas</h4>
                    <FolderTree selectedProject={selectedProject} />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'user access':
        return (
          <div className="module-content">
            <div className="module-header">
              <h2>Asignación de Usuarios</h2>
              <p>Asignación masiva de accesos a usuarios en BIM360/ACC</p>
            </div>
            <UserSearch />
          </div>
        );
      case 'project-analysis':
        return (
          <div className="module-content">
            <div className="module-header">
              <h2>Estructura de Carpetas</h2>
              <p>Visualización completa de la estructura de carpetas del proyecto BIM 360/ACC</p>
            </div>
            <ProjectSearch setSelectedProject={setSelectedProject} />
            {selectedProject && (
              <div style={{ marginTop: "20px" }}>
                <h3>Proyecto seleccionado: {selectedProject.name}</h3>
                <ProjectAnalysis selectedProject={selectedProject} />
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="module-content">
            <div className="module-header">
              <h2>Bienvenido al Sistema</h2>
              <p>Selecciona un módulo del menú para comenzar</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="module-router">
      {renderModule()}
    </div>
  );
};

export default ModuleRouter; 