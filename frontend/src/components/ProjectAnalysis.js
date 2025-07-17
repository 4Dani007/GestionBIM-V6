import React, { useState, useRef, useMemo } from "react";
import ProjectFolderTree from "./ProjectFolderTree";
import ProjectSearch from "./ProjectSearch";
import "./ProjectAnalysis.css";

// Función utilitaria para aplanar árbol de carpetas a { path: folder } y comparar permisos
function flattenFolders(tree, parentPath = "") {
  let map = {};
  tree.forEach(folder => {
    // Eliminar 'project files' o 'archivos de proyecto' del inicio de la ruta
    let name = folder.name?.toLowerCase();
    let skipRoot = name === 'project files' || name === 'archivos de proyecto';
    const path = skipRoot ? "" : (parentPath ? `${parentPath}/${folder.name}` : folder.name);
    if (!skipRoot) map[path] = folder;
    if (folder.children && folder.children.length > 0) {
      Object.assign(map, flattenFolders(folder.children, skipRoot ? "" : path));
    }
  });
  return map;
}

function comparePermissions(permsA, permsB) {
  // Normaliza a string para comparación simple
  const norm = perms => (Array.isArray(perms) ? perms.map(p => JSON.stringify(p)).sort() : []);
  const a = norm(permsA);
  const b = norm(permsB);
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true;
  return false;
}

// Componente Modal para mostrar diferencias de permisos
function PermissionsDiffModal({ isOpen, onClose, folderPath, projectA, projectB, folderA, folderB }) {
  if (!isOpen) return null;

  const renderPermissions = (permissions, projectName) => {
    if (!permissions || permissions.error) {
      return <div style={{color: '#ef4444', fontStyle: 'italic'}}>Error al cargar permisos</div>;
    }
    if (!Array.isArray(permissions) && permissions.data) {
      permissions = permissions.data;
    }
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return <div style={{color: '#6b7280', fontStyle: 'italic'}}>Sin permisos asignados</div>;
    }
    
    return (
      <div style={{maxHeight: '300px', overflowY: 'auto'}}>
        {permissions.map((perm, idx) => (
          <div key={idx} style={{
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            padding: '8px',
            marginBottom: '8px',
            backgroundColor: '#f9fafb'
          }}>
            <div style={{fontWeight: '600', color: '#374151', marginBottom: '4px'}}>
              {perm.name || perm.email || perm.role || 'Usuario/Rol'}
            </div>
            {Array.isArray(perm.actions) && perm.actions.length > 0 && (
              <div style={{fontSize: '0.9rem', color: '#059669'}}>
                <strong>Directos:</strong> {perm.actions.join(', ')}
              </div>
            )}
            {Array.isArray(perm.inheritActions) && perm.inheritActions.length > 0 && (
              <div style={{fontSize: '0.9rem', color: '#7c3aed'}}>
                <strong>Heredados:</strong> {perm.inheritActions.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Diferencias de Permisos</h3>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{marginBottom: '16px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '8px'}}>
            <strong>Carpeta:</strong> {folderPath}
          </div>
          <div style={{display: 'flex', gap: '20px'}}>
            <div style={{flex: 1}}>
              <h4 style={{margin: '0 0 12px 0', color: '#1f2937'}}>{projectA}</h4>
              {renderPermissions(folderA?.permissions, projectA)}
            </div>
            <div style={{flex: 1}}>
              <h4 style={{margin: '0 0 12px 0', color: '#1f2937'}}>{projectB}</h4>
              {renderPermissions(folderB?.permissions, projectB)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectAnalysis({ selectedProject }) {
  const [compareMode, setCompareMode] = useState(false);
  const [secondProject, setSecondProject] = useState(null);
  const [panelWidths, setPanelWidths] = useState([50, 50]);
  const containerRef = useRef(null);
  const isDragging = useRef(false);

  // --- COMPARACIÓN AUTOMÁTICA ---
  // Guardar los árboles de carpetas de ambos proyectos
  const [treeA, setTreeA] = useState([]);
  const [treeB, setTreeB] = useState([]);

  // Recibe el árbol desde ProjectFolderTree
  const handleTreeA = t => setTreeA(t);
  const handleTreeB = t => setTreeB(t);

  // Calcular diferencias
  const diffResult = useMemo(() => {
    if (!compareMode || !treeA.length || !treeB.length) return null;
    const flatA = flattenFolders(treeA);
    const flatB = flattenFolders(treeB);
    const keysA = Object.keys(flatA);
    const keysB = Object.keys(flatB);
    const onlyA = keysA.filter(k => !flatB[k]);
    const onlyB = keysB.filter(k => !flatA[k]);
    const comunes = keysA.filter(k => flatB[k]);
    // Diferencias de permisos en comunes
    const permsDiff = comunes.filter(k => comparePermissions(flatA[k].permissions, flatB[k].permissions));
    return {
      onlyA,
      onlyB,
      comunes,
      permsDiff,
      flatA,
      flatB
    };
  }, [compareMode, treeA, treeB]);

  // --- MODAL STATE ---
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDiffPath, setSelectedDiffPath] = useState(null);

  const openDiffModal = (path) => {
    setSelectedDiffPath(path);
    setModalOpen(true);
  };

  // --- DRAG DIVIDER ---
  const handleMouseDown = (e) => {
    if (!containerRef.current) return;
    isDragging.current = true;
    const container = containerRef.current;
    const startX = e.clientX;
    const startWidths = [...panelWidths];
    const onMouseMove = (moveEvent) => {
      if (!isDragging.current) return;
      const deltaX = moveEvent.clientX - startX;
      const containerWidth = container.offsetWidth;
      let leftPercent = ((startWidths[0] * containerWidth / 100) + deltaX) / containerWidth * 100;
      let rightPercent = 100 - leftPercent;
      if (leftPercent < 20) leftPercent = 20;
      if (leftPercent > 80) leftPercent = 80;
      rightPercent = 100 - leftPercent;
      setPanelWidths([leftPercent, rightPercent]);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  if (!selectedProject) {
    return (
      <div className="analysis-placeholder">
        <div className="placeholder-icon">📂</div>
        <h3>Selecciona un proyecto</h3>
        <p>Para ver la estructura de carpetas, primero selecciona un proyecto del sistema</p>
      </div>
    );
  }

  return (
    <div className="project-analysis">
      <div className="analysis-header">
        <h2>Estructura de Carpetas del Proyecto</h2>
        <p>Visualización completa de la estructura de carpetas: {selectedProject.name}</p>
        <button
          className="compare-project-btn"
          onClick={() => setCompareMode((prev) => !prev)}
        >
          {compareMode ? "Cerrar comparación" : "Comparar proyecto"}
        </button>
      </div>
      <div
        className={`analysis-content${compareMode ? " compare-mode" : ""}`}
        style={compareMode ? {flexDirection: 'row', gap: 0, position: 'relative'} : {}}
        ref={containerRef}
      >
        <div
          style={compareMode ? {
            flex: `0 0 ${panelWidths[0]}%`,
            minWidth: 0,
            transition: isDragging.current ? 'none' : 'flex-basis 0.2s',
            overflow: 'hidden',
          } : {flex: 1, minWidth: 0}}
        >
          <ProjectFolderTree selectedProject={selectedProject} onTreeLoaded={handleTreeA} />
        </div>
        {compareMode && (
          <>
            <div
              className="compare-divider"
              onMouseDown={handleMouseDown}
              style={{cursor: 'col-resize', width: 10, background: 'transparent', zIndex: 2, position: 'relative'}}
            >
              <div className="compare-divider-bar" />
            </div>
            <div
              style={{
                flex: `0 0 ${panelWidths[1]}%`,
                minWidth: 0,
                borderLeft: '2px dashed #ddd',
                paddingLeft: 20,
                transition: isDragging.current ? 'none' : 'flex-basis 0.2s',
                overflow: 'hidden',
              }}
            >
              <div style={{marginBottom: 16}}>
                <h3 style={{margin: 0, fontSize: '1.1rem'}}>Selecciona proyecto a comparar</h3>
                {secondProject ? (
                  <>
                    <div style={{marginBottom: 10, fontWeight: 500, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 10}}>
                      Proyecto seleccionado: {secondProject.name}
                      <button
                        style={{marginLeft: 8, background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#6b7280', fontWeight: 500}}
                        onClick={() => { setSecondProject(null); setTreeB([]); }}
                        title="Cambiar proyecto"
                      >
                        Cambiar
                      </button>
                    </div>
                  </>
                ) : (
                  <ProjectSearch setSelectedProject={setSecondProject} />
                )}
              </div>
              {secondProject ? (
                <ProjectFolderTree selectedProject={secondProject} onTreeLoaded={handleTreeB} />
              ) : (
                <div style={{color: '#888', fontStyle: 'italic', marginTop: 20}}>Selecciona un proyecto para comparar</div>
              )}
            </div>
          </>
        )}
      </div>
      {/* Panel de diferencias debajo de los paneles comparativos */}
      {compareMode && secondProject && diffResult && (
        <div className="compare-summary-panel">
          <h3>Diferencias encontradas</h3>
          <div className="compare-summary-row">
            <div>
              <strong>Solo en {selectedProject.name}:</strong>
              {diffResult.onlyA.length > 0 ? (
                <ul>{diffResult.onlyA.map(path => <li key={path}>{path}</li>)}</ul>
              ) : <span> Ninguna</span>}
            </div>
            <div>
              <strong>Solo en {secondProject.name}:</strong>
              {diffResult.onlyB.length > 0 ? (
                <ul>{diffResult.onlyB.map(path => <li key={path}>{path}</li>)}</ul>
              ) : <span> Ninguna</span>}
            </div>
            <div>
              <strong>Carpetas comunes con permisos diferentes:</strong>
              {diffResult.permsDiff.length > 0 ? (
                <ul>
                  {diffResult.permsDiff.map(path => (
                    <li key={path}>
                      <button
                        className="diff-folder-btn"
                        onClick={() => openDiffModal(path)}
                        title="Ver diferencias de permisos"
                      >
                        {path}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <span> Ninguna</span>}
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de diferencias de permisos */}
      <PermissionsDiffModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        folderPath={selectedDiffPath}
        projectA={selectedProject?.name}
        projectB={secondProject?.name}
        folderA={selectedDiffPath ? diffResult?.flatA[selectedDiffPath] : null}
        folderB={selectedDiffPath ? diffResult?.flatB[selectedDiffPath] : null}
      />
    </div>
  );
}

export default ProjectAnalysis; 