import React, { useState, useEffect } from "react";
import "./PermissionsTable.css";

function PermissionsTable({ folderId, projectId, folderName, allFolders }) {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [folderTracker, setFolderTracker] = useState({});

  const highlightNames = [
    "Profesional Financiero",
  ];

  useEffect(() => {
    if (folderId && projectId) {
      fetchPermissions(folderId, projectId);
    }
  }, [folderId, projectId]);

  const fetchPermissions = async (folderId, projectId) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `http://localhost:5000/api/permissions?urn=${folderId}&project_id=${projectId}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error("No se pudieron obtener los permisos");
      }

      const data = await response.json();
      console.log("📜 Permisos recibidos:", data);
      setPermissions(data);
      
      // Actualizar el rastreador de carpetas con la ruta completa
      updateFolderTracker(data, folderId, getFolderPath(folderId));
    } catch (error) {
      console.error("Error obteniendo permisos:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getFolderPath = (folderId) => {
    if (!allFolders || allFolders.length === 0) return `Carpeta ${folderId}`;
    
    const folder = allFolders.find(f => f.id === folderId);
    if (!folder) return `Carpeta ${folderId}`;
    
    // Construir la ruta completa usando la estructura de carpetas
    let pathParts = [];
    let currentFolder = folder;
    
    while (currentFolder) {
      pathParts.unshift(currentFolder.name);
      // Encontrar el padre (asumiendo que el path contiene la jerarquía)
      const parentPath = currentFolder.path.slice(0, -1);
      if (parentPath.length === 0) break;
      
      const parentId = parentPath[parentPath.length - 1];
      currentFolder = allFolders.find(f => f.id === parentId);
    }
    
    return pathParts.join(' > ');
  };

  const updateFolderTracker = (permissionsData, currentFolderId, currentFolderPath) => {
  const foundFunctions = [];

  permissionsData.forEach((perm) => {
    const name = perm.name || perm.email || "Desconocido";
    if (highlightNames.includes(name)) {
      // Obtener permisos directos e heredados
      const directPermissions = mapPermissions(perm.actions);
      const inheritedPermissions = mapPermissions(perm.inheritActions);
      
      // Solo considerar si tiene permisos directos (no heredados)
      if (directPermissions !== "Ninguna") {
        foundFunctions.push({ 
          name, 
          permissionLevel: directPermissions,
          isInherited: false // Siempre será false porque solo agregamos directos
        });
      }
    }
  });

  if (foundFunctions.length > 0) {
    setFolderTracker((prevTracker) => {
      const newTracker = { ...prevTracker };

      foundFunctions.forEach(({ name, permissionLevel }) => {
        if (!newTracker[name]) {
          newTracker[name] = [];
        }

        const exists = newTracker[name].some(
          (folder) => folder.id === currentFolderId
        );

        if (!exists) {
          newTracker[name].push({
            id: currentFolderId,
            name: currentFolderPath,
            timestamp: new Date().toLocaleString(),
            permission: permissionLevel,
            isInherited: false // No es heredado
          });
        }
      });

      return newTracker;
    });
  }
};

  const mapPermissions = (actions) => {
    // Si no hay acciones, retornar "Ninguna"
    if (!actions || actions.length === 0) {
      return "Ninguna";
    }

    if (
      actions.includes("CONTROL") &&
      actions.includes("EDIT") &&
      actions.includes("PUBLISH") &&
      actions.includes("VIEW") &&
      actions.includes("DOWNLOAD") &&
      actions.includes("COLLABORATE")
    ) {
      return "Control de carpetas";
    }
    if (
      actions.includes("EDIT") &&
      actions.includes("PUBLISH") &&
      actions.includes("VIEW") &&
      actions.includes("DOWNLOAD") &&
      actions.includes("COLLABORATE")
    ) {
      return "Editar";
    }
    if (
      actions.includes("VIEW") &&
      actions.includes("DOWNLOAD") &&
      actions.includes("COLLABORATE")
    ) {
      return "Ver y Descargar";
    }
    if (
      actions.includes("PUBLISH") &&
      actions.includes("VIEW") &&
      actions.includes("DOWNLOAD") &&
      actions.includes("COLLABORATE")
    ) {
      return "Ver, Descargar y Cargar";
    }
    if (actions.includes("COLLABORATE") && actions.includes("VIEW")) {
      return "Ver";
    }

    return actions.join(", ");
  };

  // Función para obtener el icono según el tipo de permiso
  const getPermissionIcon = (permission) => {
    switch (permission) {
      case "Control de carpetas":
        return "🔧";
      case "Editar":
        return "✏️";
      case "Ver y Descargar":
        return "👁️";
      case "Ver, Descargar y Cargar":
        return "📤";
      case "Ver":
        return "👀";
      default:
        return "📋";
    }
  };

  // Función para obtener el color según el tipo de permiso
  const getPermissionColor = (permission) => {
    switch (permission) {
      case "Control de carpetas":
        return "#dc3545"; // Rojo para control total
      case "Editar":
        return "#fd7e14"; // Naranja para edición
      case "Ver y Descargar":
        return "#20c997"; // Verde azulado para ver y descargar
      case "Ver, Descargar y Cargar":
        return "#0d6efd"; // Azul para ver, descargar y cargar
      case "Ver":
        return "#6c757d"; // Gris para solo ver
      default:
        return "#28a745"; // Verde por defecto
    }
  };

  const filteredPermissions = permissions.filter((perm) => {
    const name = perm.name || perm.email || "Desconocido";
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const clearTracker = () => {
    setFolderTracker({});
  };

  if (loading) return <p>Cargando permisos...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="permissions-container">
      {/* Panel de rastreamiento de funciones */}
      {Object.keys(folderTracker).length > 0 && (
        <div className="tracker-panel">
          <h3>🔍 Funciones Rastreadas</h3>
          <button 
            onClick={clearTracker}
            className="clear-tracker-btn"
            style={{
              marginBottom: '15px',
              padding: '5px 10px',
              backgroundColor: '#ff6b6b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Limpiar Historial
          </button>
          
          {Object.entries(folderTracker).map(([funcName, folders]) => (
            <div key={funcName} className="function-tracker">
              <h4 style={{ color: '#2c5aa0', margin: '10px 0 5px 0' }}>
                📋 {funcName}
              </h4>
              <div className="folder-list">
                {folders.map((folder, index) => (
                  <div key={index} className="folder-item" style={{
                    background: '#f8f9fa',
                    padding: '12px',
                    margin: '6px 0',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${getPermissionColor(folder.permission)}`,
                    fontSize: '14px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <strong>📁 {folder.name}</strong>
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      marginBottom: '6px',
                      padding: '4px 8px',
                      backgroundColor: getPermissionColor(folder.permission),
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontWeight: 'bold'
                    }}>
                      {getPermissionIcon(folder.permission)} {folder.permission}
                      {folder.isInherited && (
                        <span style={{ 
                          marginLeft: '8px', 
                          fontSize: '11px',
                          backgroundColor: 'rgba(255,255,255,0.3)',
                          padding: '2px 6px',
                          borderRadius: '3px'
                        }}>
                          📥 Heredado
                        </span>
                      )}
                    </div>
                    
                    <small style={{ color: '#666', display: 'block' }}>
                      <strong>ID:</strong> {folder.id}
                    </small>
                    <small style={{ color: '#666', display: 'block' }}>
                      <strong>Encontrado:</strong> {folder.timestamp}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>Permisos de la Carpeta</h2>
      
      {folderName && (
        <p style={{ color: '#666', fontStyle: 'italic' }}>
          Carpeta actual: <strong>{getFolderPath(folderId)}</strong> (ID: {folderId})
        </p>
      )}

      <input
        type="text"
        placeholder="Buscar por nombre o correo..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />

      {permissions.length === 0 ? (
        <p>No se encontraron permisos para esta carpeta.</p>
      ) : (
        <div className="table-wrapper">
          <table className="permissions-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Tipo de Usuario</th>
                <th>ID del Rol</th>
                <th>Acciones en Carpeta</th>
                <th>Acciones Heredadas</th>
              </tr>
            </thead>
            <tbody>
              {filteredPermissions.slice(0, 500).map((perm, index) => {
                const shouldHighlight = highlightNames.includes(perm.name);
                const name = perm.name || perm.email || "Desconocido";

                return (
                  <tr key={index} className={shouldHighlight ? "highlight" : ""}>
                    <td>{name}</td>
                    <td>{perm.userType || "N/A"}</td>
                    <td>{perm.subjectId || "N/A"}</td>
                    <td>{mapPermissions(perm.actions)}</td>
                    <td>{mapPermissions(perm.inheritActions)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PermissionsTable;