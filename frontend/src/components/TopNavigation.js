import React from 'react';
import { ArrowLeft, Home, User, LogOut } from 'lucide-react';
import './TopNavigation.css';

const TopNavigation = ({ 
  activeModule, 
  onBackToMenu, 
  userProfile, 
  onLogout,
  showBackButton = true 
}) => {
  const getModuleInfo = (moduleId) => {
    const modules = {
      'Permissions': { name: 'Permisos', color: '#3B82F6' },
      'user access': { name: 'Asignar usuarios', color: '#10B981' }
    };
    return modules[moduleId] || { name: 'Sistema', color: '#3B82F6' };
  };

  const moduleInfo = getModuleInfo(activeModule);

  return (
    <div className="top-navigation">
      <div className="nav-left">
        {showBackButton && activeModule && (
          <button 
            className="back-button"
            onClick={onBackToMenu}
            style={{ borderColor: moduleInfo.color }}
          >
            <ArrowLeft size={20} />
            <span>Volver al Menú</span>
          </button>
        )}
        
        {activeModule && (
          <div className="current-module">
            <div 
              className="module-indicator"
              style={{ backgroundColor: moduleInfo.color }}
            ></div>
            <span className="module-name">{moduleInfo.name}</span>
          </div>
        )}
      </div>

      <div className="nav-center">
        <div className="app-title">
          <Home size={24} />
          <h1>Visor de Permisos v5</h1>
        </div>
      </div>

      <div className="nav-right">
      </div>
    </div>
  );
};

export default TopNavigation; 