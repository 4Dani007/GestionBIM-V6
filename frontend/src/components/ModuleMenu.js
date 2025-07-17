import React from 'react';
import { FolderOpen, Users, Settings, BarChart3, FileText, Database } from 'lucide-react';
import './ModuleMenu.css';

const ModuleMenu = ({ activeModule, onModuleChange }) => {
  const modules = [
    {
      id: 'Permissions',
      name: 'Permisos',
      icon: FolderOpen,
      description: 'Validacion de permisos en proyectos BIM 360/ACC',
      color: '#3B82F6'
    },
    {
      id: 'user access',
      name: 'Asignar usuarios',
      icon: Users,
      description: 'Asignación masiva de accesos a usuarios en BIM360/ACC',
      color: '#10B981'
    },
    {
      id: 'project-analysis',
      name: 'Estructura de Carpetas',
      icon: BarChart3,
      description: 'Visualización completa de la estructura de carpetas del proyecto BIM 360/ACC',
      color: '#8B5CF6'
    },
  ];

  return (
    <div className="module-menu">
      <div className="module-menu-header">
        <h2>Módulos del Sistema</h2>
        <p>Selecciona un módulo para comenzar</p>
      </div>
      
      <div className="module-grid">
        {modules.map((module) => {
          const IconComponent = module.icon;
          const isActive = activeModule === module.id;
          
          return (
            <div
              key={module.id}
              className={`module-card ${isActive ? 'active' : ''}`}
              onClick={() => onModuleChange(module.id)}
              style={{ 
                borderColor: isActive ? module.color : '#e5e7eb',
                backgroundColor: isActive ? `${module.color}10` : 'white'
              }}
            >
              <div 
                className="module-icon"
                style={{ backgroundColor: module.color }}
              >
                <IconComponent size={24} color="white" />
              </div>
              
              <div className="module-content">
                <h3 className="module-title">{module.name}</h3>
                <p className="module-description">{module.description}</p>
              </div>
              
              {isActive && (
                <div className="active-indicator" style={{ backgroundColor: module.color }}>
                  <div className="active-dot"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ModuleMenu; 