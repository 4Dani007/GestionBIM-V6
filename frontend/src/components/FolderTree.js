import React, { useState, useEffect, useCallback } from "react";
import PermissionsTable from "./PermissionsTable";

function FolderTree({ selectedProject }) {
  const [rootFolderId, setRootFolderId] = useState(null);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Memoizar la función loadSubfolders
  const loadSubfolders = useCallback(async (projectId, folderId, parentPath) => {
    try {
      const response = await fetch(
        `https://gestionbim-v6.onrender.com/subfolders?project_id=${projectId}&folder_id=${folderId}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error("No se pudieron cargar las subcarpetas");
      }

      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        setFolders((prev) => {
          const newFolders = data
            .filter(
              (folder) =>
                folder && folder.id && folder.name &&
                !prev.some((existingFolder) => existingFolder.id === folder.id)
            )
            .map((folder) => ({
              id: folder.id,
              name: folder.name,
              path: [...parentPath, folder.id],
              expanded: false,
            }));

          return [...prev, ...newFolders];
        });
      }
    } catch (error) {
      setError(error.message);
    }
  }, []);

  // Memoizar la función loadRootFolder
  const loadRootFolder = useCallback(async (projectId) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://gestionbim-v6.onrender.com/project-folders?project_id=${projectId}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error("No se pudo obtener la carpeta raíz");
      }

      const data = await response.json();

      if (data.folder_id) {
        setRootFolderId(data.folder_id);
        // Inicializar con la carpeta raíz
        setFolders([{
          id: data.folder_id,
          name: "Raíz del proyecto",
          path: [data.folder_id],
          expanded: false
        }]);
        loadSubfolders(projectId, data.folder_id, [data.folder_id]);
      } else {
        setRootFolderId(null);
        setFolders([]);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [loadSubfolders]);

  // Cargar la carpeta raíz cuando se selecciona un proyecto
  useEffect(() => {
    if (selectedProject?.id) {
      setFolders([]);
      setSelectedFolder(null);
      loadRootFolder(selectedProject.id);
    }
  }, [selectedProject, loadRootFolder]);

  // Función para expandir/colapsar una carpeta
  const toggleFolder = useCallback((folder) => {
    if (!folder.expanded) {
      loadSubfolders(selectedProject.id, folder.id, folder.path);
    }

    setFolders((prev) =>
      prev.map((f) =>
        f.id === folder.id ? { ...f, expanded: !f.expanded } : f
      )
    );
  }, [loadSubfolders, selectedProject?.id]);

  // Función para manejar el clic en una carpeta
  const handleFolderClick = useCallback((folder) => {
    setSelectedFolder(folder);
  }, []);

  if (loading) return <div>Cargando estructura de carpetas...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      {/* Columna izquierda: Árbol de carpetas */}
      <div style={{ flex: 1, maxWidth: "300px" }}>
        <h2>📂 Estructura de Carpetas</h2>
        {selectedFolder && (
          <div 
            style={{
              backgroundColor: "#e3f2fd",
              border: "1px solid #2196f3",
              borderRadius: "4px",
              padding: "8px",
              marginBottom: "10px",
              fontSize: "14px"
            }}
          >
            <strong>📍 Carpeta seleccionada:</strong><br />
            {selectedFolder.name}
          </div>
        )}
        {rootFolderId ? (
          <ul style={{ listStyle: "none", paddingLeft: 0 }}>
            {folders
              .filter((folder) => folder.path.length === 1)
              .map((folder) => (
                <FolderNode
                  key={folder.id}
                  folder={folder}
                  folders={folders}
                  toggleFolder={toggleFolder}
                  onFolderClick={handleFolderClick}
                  selectedFolderId={selectedFolder?.id}
                />
              ))}
          </ul>
        ) : (
          <p>No se encontró la carpeta raíz.</p>
        )}
      </div>

      {/* Columna derecha: Tabla de permisos */}
      <div style={{ flex: 2 }}>
        {selectedFolder ? (
          <div>
            <div 
              style={{
                backgroundColor: "#f5f5f5",
                padding: "10px",
                borderRadius: "4px",
                marginBottom: "15px",
                borderLeft: "4px solid #2196f3"
              }}
            >
              <h3 style={{ margin: "0 0 5px 0" }}>
                Permisos de: {selectedFolder.name}
              </h3>
              <small style={{ color: "#666" }}>
                ID: {selectedFolder.id}
              </small>
            </div>
            <PermissionsTable
              folderId={selectedFolder.id}
              projectId={selectedProject.id}
              folderName={selectedFolder.name}
              allFolders={folders}
            />
          </div>
        ) : (
          <div 
            style={{
              textAlign: "center",
              padding: "40px",
              color: "#999",
              fontStyle: "italic"
            }}
          >
            Selecciona una carpeta para ver sus permisos
          </div>
        )}
      </div>
    </div>
  );
}

// Componente FolderNode (recursivo para mostrar subcarpetas)
function FolderNode({ folder, folders, toggleFolder, onFolderClick, selectedFolderId }) {
  const isSelected = folder.id === selectedFolderId;
  
  const handleFolderClick = () => {
    onFolderClick(folder);
  };

  const handleToggleClick = (e) => {
    e.stopPropagation();
    toggleFolder(folder);
  };
  
  return (
    <li style={{ marginBottom: "2px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 8px",
          borderRadius: "4px",
          cursor: "pointer",
          backgroundColor: isSelected ? "#2196f3" : "transparent",
          color: isSelected ? "white" : "#333",
          border: isSelected ? "2px solid #1976d2" : "2px solid transparent",
          transition: "all 0.2s ease"
        }}
        onClick={handleFolderClick}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.target.style.backgroundColor = "#f5f5f5";
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.target.style.backgroundColor = "transparent";
          }
        }}
      >
        <span
          onClick={handleToggleClick}
          style={{
            marginRight: "8px",
            fontSize: "14px",
            minWidth: "20px",
            textAlign: "center",
            cursor: "pointer"
          }}
        >
          {folder.expanded ? "📂" : "📁"}
        </span>
        <span style={{ 
          fontWeight: isSelected ? "bold" : "normal",
          flex: 1
        }}>
          {folder.name}
        </span>
        {isSelected && (
          <span style={{ 
            fontSize: "12px", 
            marginLeft: "8px",
            opacity: 0.8
          }}>
            ✓
          </span>
        )}
      </div>
      {folder.expanded && (
        <ul style={{ 
          listStyle: "none", 
          paddingLeft: "20px", 
          marginTop: "4px" 
        }}>
          {folders
            .filter(
              (subfolder) =>
                subfolder.path.length === folder.path.length + 1 &&
                subfolder.path.slice(0, -1).join() === folder.path.join()
            )
            .map((subfolder) => (
              <FolderNode
                key={subfolder.id}
                folder={subfolder}
                folders={folders}
                toggleFolder={toggleFolder}
                onFolderClick={onFolderClick}
                selectedFolderId={selectedFolderId}
              />
            ))}
        </ul>
      )}
    </li>
  );
}

export default FolderTree;