import React, { useState, useEffect, useMemo, useRef } from "react";
import "./ProjectFolderTree.css";

function ProjectFolderTree({ selectedProject, onTreeLoaded }) {
  const [foldersTree, setFoldersTree] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleSearch, setRoleSearch] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const folderRefs = useRef({});
  const [showPermissions, setShowPermissions] = useState({}); // { [folderId]: true/false }
  // Estado para la fecha de los datos y recarga
  const [dataDate, setDataDate] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Barra de progreso progresiva
  const [progress, setProgress] = useState(0);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const progressRef = useRef(null);

  useEffect(() => {
    if (selectedProject?.id) {
      loadProjectFoldersTree(selectedProject.id);
    }
    // Limpiar barra de progreso si se desmonta
    return () => clearInterval(progressRef.current);
  }, [selectedProject]);

  // Notificar árbol cargado al padre
  useEffect(() => {
    if (typeof onTreeLoaded === 'function') {
      onTreeLoaded(foldersTree);
    }
  }, [foldersTree, onTreeLoaded]);

  // Iniciar barra de progreso progresiva
  const startProgressBar = () => {
    setProgress(0);
    setShowProgressBar(true);
    const totalDuration = 9 * 60 * 1000; // 9 minutos en ms
    const updateInterval = 1000; // cada segundo
    const maxProgress = 95;
    const increment = maxProgress / (totalDuration / updateInterval);
    clearInterval(progressRef.current);
    progressRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev + increment >= maxProgress) {
          clearInterval(progressRef.current);
          return maxProgress;
        }
        return prev + increment;
      });
    }, updateInterval);
  };

  // Detener y completar barra de progreso
  const stopProgressBar = () => {
    clearInterval(progressRef.current);
    setProgress(100);
    setTimeout(() => setShowProgressBar(false), 700); // Oculta la barra tras 0.7s
  };

  // Modificar la carga de datos para guardar la fecha y manejar la barra de progreso
  const loadProjectFoldersTree = async (projectId, forceRefresh = false) => {
    setLoading(true);
    setError(null);
    setExpandedFolders(new Set());
    setSelectedRole(null);
    setRoleSearch("");
    setSelectedFolderId(null);
    if (forceRefresh) setIsRefreshing(true);
    startProgressBar();
    try {
      const response = await fetch(
        `http://localhost:5000/api/project-folders-tree?project_id=${projectId}${forceRefresh ? "&force_refresh=true" : ""}`,
        { credentials: "include" }
      );
      if (!response.ok) {
        throw new Error("No se pudo cargar la estructura de carpetas del proyecto");
      }
      const data = await response.json();
      setFoldersTree(data.folders || []);
      setDataDate(data.updatedAt || null);
      // Si la respuesta es de caché, completar la barra rápidamente
      if (data.from_cache) {
        setProgress(100);
        setTimeout(() => setShowProgressBar(false), 500);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      // Solo detener la barra si no es de caché (para evitar doble stop)
      // Si es de caché, ya se detuvo arriba
      // Si no es de caché, detener normalmente
      // (esto previene que la barra desaparezca antes de tiempo)
      // Si quieres que siempre se detenga, puedes dejar solo stopProgressBar();
      // Pero así es más suave visualmente
      // stopProgressBar();
      // ---
      // Nueva lógica:
      // Si no es de caché, detener normalmente
      if (!foldersTree.length || (foldersTree.length && !(foldersTree.from_cache))) {
        stopProgressBar();
      }
    }
  };

  // Extraer todos los roles únicos de los permisos de todas las carpetas
  const allRoles = useMemo(() => {
    const rolesSet = new Set();
    function traverse(folder) {
      if (folder.permissions && Array.isArray(folder.permissions)) {
        folder.permissions.forEach(perm => {
          if (perm.role) rolesSet.add(perm.role);
          else if (perm.name) rolesSet.add(perm.name);
        });
      }
      if (folder.children && folder.children.length > 0) {
        folder.children.forEach(traverse);
      }
    }
    foldersTree.forEach(traverse);
    return Array.from(rolesSet).sort();
  }, [foldersTree]);

  // Filtrar roles por el texto del buscador
  const filteredRoles = useMemo(() => {
    if (!roleSearch.trim()) return allRoles;
    return allRoles.filter(role => role.toLowerCase().includes(roleSearch.trim().toLowerCase()));
  }, [allRoles, roleSearch]);

  // Filtrar el árbol de carpetas para mostrar solo las que contienen el rol seleccionado
  const filterTreeByRole = (tree, role) => {
    if (!role) return tree;
    function filterNode(node) {
      // ¿Esta carpeta tiene el rol en sus permisos?
      const hasRole = Array.isArray(node.permissions) && node.permissions.some(
        perm => perm.role === role || perm.name === role
      );
      // Filtrar hijos recursivamente
      let filteredChildren = [];
      if (node.children && node.children.length > 0) {
        filteredChildren = node.children.map(filterNode).filter(Boolean);
      }
      // Incluir este nodo si tiene el rol o alguno de sus hijos lo tiene
      if (hasRole || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren
        };
      }
      return null;
    }
    return tree.map(filterNode).filter(Boolean);
  };

  const filteredFoldersTree = useMemo(() => filterTreeByRole(foldersTree, selectedRole), [foldersTree, selectedRole]);

  // Encuentra el nodo 'Project Files' o 'Archivos de proyecto' en el árbol
  const getProjectFilesNode = (tree) => {
    for (const node of tree) {
      if (
        node.name?.toLowerCase() === 'project files' ||
        node.name?.toLowerCase() === 'archivos de proyecto'
      ) {
        return node;
      }
    }
    return null;
  };

  // Nuevo contador de carpetas principales
  const projectFilesNode = getProjectFilesNode(filteredFoldersTree);
  const mainFoldersCount = projectFilesNode && Array.isArray(projectFilesNode.children)
    ? projectFilesNode.children.length
    : 0;

  // Dashboard de resumen para el rol seleccionado
  const dashboardInfo = useMemo(() => {
    if (!selectedRole) return null;
    let carpetasDirectas = [];
    let carpetasHeredadas = [];
    let directos = 0;
    let heredados = 0;
    function traverse(folder) {
      let foundDirecto = false;
      let foundHeredado = false;
      if (folder.permissions && Array.isArray(folder.permissions)) {
        folder.permissions.forEach(perm => {
          if (perm.role === selectedRole || perm.name === selectedRole) {
            if (Array.isArray(perm.actions) && perm.actions.length > 0) {
              directos++;
              foundDirecto = true;
            }
            if (Array.isArray(perm.inheritActions) && perm.inheritActions.length > 0) {
              heredados++;
              foundHeredado = true;
            }
          }
        });
      }
      if (foundDirecto) {
        carpetasDirectas.push({ id: folder.id, name: folder.name });
      }
      if (foundHeredado) {
        carpetasHeredadas.push({ id: folder.id, name: folder.name });
      }
      if (folder.children && folder.children.length > 0) {
        folder.children.forEach(traverse);
      }
    }
    filteredFoldersTree.forEach(traverse);
    return {
      directos,
      heredados,
      carpetasDirectas,
      carpetasHeredadas,
      totalCarpetasDirectas: carpetasDirectas.length,
      totalCarpetasHeredadas: carpetasHeredadas.length,
    };
  }, [selectedRole, filteredFoldersTree]);

  // Al hacer clic en una carpeta desde el dashboard, expandir solo los ancestros necesarios para que el nodo exista, luego seleccionarla y hacer scroll
  const expandFolderById = (folderId) => {
    // Recorrer el árbol y expandir solo los ancestros de la carpeta
    const expandAncestors = (folders, targetId, path = []) => {
      for (const folder of folders) {
        if (folder.id === targetId) {
          return [...path, folder.id];
        }
        if (folder.children && folder.children.length > 0) {
          const result = expandAncestors(folder.children, targetId, [...path, folder.id]);
          if (result) return result;
        }
      }
      return null;
    };
    const pathToExpand = expandAncestors(filteredFoldersTree, folderId);
    if (pathToExpand) {
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        // Expandir solo los ancestros, no la carpeta seleccionada
        pathToExpand.slice(0, -1).forEach(id => newSet.add(id));
        return newSet;
      });
    }
    setSelectedFolderId(folderId);
    setTimeout(() => {
      if (folderRefs.current[folderId]) {
        folderRefs.current[folderId].scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 200);
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const getFolderIcon = (hasChildren, isExpanded) => {
    if (!hasChildren) return "📄";
    return isExpanded ? "📂" : "📁";
  };

  // Renderiza los permisos de una carpeta
  const renderPermissions = (permissions) => {
    if (!permissions || permissions.error) {
      return <div className="folder-permissions-empty">No se pudieron obtener los permisos.</div>;
    }
    if (!Array.isArray(permissions) && permissions.data) {
      permissions = permissions.data;
    }
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return <div className="folder-permissions-empty">Sin permisos asignados.</div>;
    }
    // Si hay un rol seleccionado, filtrar solo los permisos de ese rol
    let filtered = permissions;
    if (selectedRole) {
      filtered = permissions.filter(
        perm => perm.role === selectedRole || perm.name === selectedRole
      );
      if (filtered.length === 0) {
        return <div className="folder-permissions-empty">Sin permisos asignados para este rol.</div>;
      }
    }
    // Construir filas para directos y heredados
    const rows = [];
    filtered.forEach((perm) => {
      if (Array.isArray(perm.actions) && perm.actions.length > 0) {
        rows.push({
          name: perm.name || perm.email || perm.role || 'Desconocido',
          actions: perm.actions,
          tipo: 'Directo',
        });
      }
      if (Array.isArray(perm.inheritActions) && perm.inheritActions.length > 0) {
        rows.push({
          name: perm.name || perm.email || perm.role || 'Desconocido',
          actions: perm.inheritActions,
          tipo: 'Heredado',
        });
      }
    });
    if (rows.length === 0) {
      return <div className="folder-permissions-empty">Sin permisos asignados para este rol.</div>;
    }
    return (
      <table className="folder-permissions-table">
        <thead>
          <tr>
            <th>Usuario/Rol</th>
            <th>Permisos</th>
            <th>Tipo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              <td>{row.name}</td>
              <td>{Array.isArray(row.actions) ? row.actions.join(', ') : JSON.stringify(row.actions)}</td>
              <td>{row.tipo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // Modificar renderFolderNode para resaltar la carpeta seleccionada y asignar ref
  const renderFolderNode = (folder, level = 0) => {
    const hasChildren = folder.children && folder.children.length > 0;
    const isExpanded = expandedFolders.has(folder.id);
    const icon = getFolderIcon(hasChildren, isExpanded);
    const isSelected = selectedFolderId === folder.id;
    const isPermVisible = !!showPermissions[folder.id];

    return (
      <div
        key={folder.id}
        className={`folder-node${isSelected ? " selected-folder-node" : ""}`}
        ref={el => (folderRefs.current[folder.id] = el)}
      >
        <div
          className={`folder-item${isSelected ? " selected-folder-item" : ""}`}
          style={{ paddingLeft: `${level * 20 + 10}px` }}
          onClick={() => setSelectedFolderId(folder.id)}
        >
          <div className="folder-content">
            {hasChildren && (
              <button
                className="expand-button"
                onClick={e => { e.stopPropagation(); toggleFolder(folder.id); }}
                aria-label={isExpanded ? "Colapsar carpeta" : "Expandir carpeta"}
              >
                {isExpanded ? "▼" : "▶"}
              </button>
            )}
            <span className="folder-icon">{icon}</span>
            <span className="folder-name">{folder.name}</span>
            {hasChildren && (
              <span className="folder-count">({folder.children.length})</span>
            )}
          </div>
          <div className="folder-path">{folder.path}</div>
          {/* Botón para mostrar/ocultar permisos */}
          <button
            className={`toggle-perms-btn${isPermVisible ? " active" : ""}`}
            onClick={e => { e.stopPropagation(); setShowPermissions(prev => ({ ...prev, [folder.id]: !isPermVisible })); }}
          >
            {isPermVisible ? "Ocultar permisos" : "Ver permisos"}
          </button>
          {/* Permisos de la carpeta */}
          {isPermVisible && (
            <div className="folder-permissions">
              {renderPermissions(folder.permissions)}
            </div>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="folder-children">
            {folder.children.map(child => renderFolderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const getTotalFolders = (folders) => {
    let total = 0;
    folders.forEach(folder => {
      total += 1;
      if (folder.children && folder.children.length > 0) {
        total += getTotalFolders(folder.children);
      }
    });
    return total;
  };

  // Calcular si los datos tienen más de 1 mes
  const isDataOld = useMemo(() => {
    if (!dataDate) return false;
    const now = new Date();
    const updated = new Date(dataDate);
    return (now - updated) > 30 * 24 * 60 * 60 * 1000; // 30 días
  }, [dataDate]);

  if (loading || showProgressBar) {
    return (
      <div className="folder-tree-loading">
        {showProgressBar ? (
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
            <span className="progress-bar-label">{Math.round(progress)}%</span>
          </div>
        ) : (
          <div className="loading-spinner"></div>
        )}
        <p>Cargando estructura de carpetas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="folder-tree-error">
        <div className="error-icon">⚠️</div>
        <h3>Error al cargar las carpetas</h3>
        <p>{error}</p>
        <button
          className="retry-button"
          onClick={() => selectedProject && loadProjectFoldersTree(selectedProject.id)}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="folder-tree-placeholder">
        <div className="placeholder-icon">📂</div>
        <h3>Selecciona un proyecto</h3>
        <p>Para ver la estructura de carpetas, primero selecciona un proyecto</p>
      </div>
    );
  }

  const totalFolders = getTotalFolders(filteredFoldersTree);

  return (
    <div className="project-folder-tree-layout">
      {/* Panel lateral de roles */}
      <aside className="roles-panel">
        <h4>Roles encontrados</h4>
        <input
          className="roles-search"
          type="text"
          placeholder="Buscar rol..."
          value={roleSearch}
          onChange={e => setRoleSearch(e.target.value)}
        />
        {filteredRoles.length > 0 ? (
          <ul className="roles-list">
            {filteredRoles.map((role, idx) => (
              <li
                key={idx}
                className={`role-item${selectedRole === role ? " selected" : ""}`}
                onClick={() => setSelectedRole(selectedRole === role ? null : role)}
                tabIndex={0}
                style={{ cursor: "pointer" }}
              >
                {role}
              </li>
            ))}
          </ul>
        ) : (
          <div className="roles-empty">No se encontraron roles.</div>
        )}
        {selectedRole && (
          <button className="clear-role-btn" onClick={() => setSelectedRole(null)}>
            Limpiar filtro
          </button>
        )}
      </aside>
      {/* Panel principal: árbol de carpetas y dashboard a la derecha */}
      <div className="project-folder-tree-main">
        <div className="folder-tree-header">
          <h3>📂 Estructura Completa de Carpetas</h3>
          <div className="folder-meta-row">
            {dataDate && (
              <span className="folder-data-date">
                Datos actualizados: {new Date(dataDate).toLocaleString()}
              </span>
            )}
            <button
              className="refresh-data-btn"
              onClick={() => loadProjectFoldersTree(selectedProject.id, true)}
              disabled={isRefreshing || showProgressBar}
            >
              {isRefreshing || showProgressBar ? "Actualizando..." : "Actualizar datos"}
            </button>
          </div>
          {isDataOld && (
            <div className="folder-data-warning">
              ⚠️ Los datos tienen más de 1 mes. Considera actualizar para obtener información reciente.
            </div>
          )}
          <div className="folder-stats">
            <span className="stat-item">
              <strong>Carpetas principales:</strong> {mainFoldersCount}
            </span>
            <span className="stat-item">
              <strong>Total de carpetas:</strong> {totalFolders}
            </span>
          </div>
        </div>
        <div className="tree-and-dashboard">
          <div className="folder-tree-content">
            <div className="folder-tree-list">
              {filteredFoldersTree.map(folder => renderFolderNode(folder))}
            </div>
            <div className="folder-tree-actions">
              <button 
                className="action-button expand-all"
                onClick={() => {
                  const allFolderIds = new Set();
                  const collectIds = (folders) => {
                    folders.forEach(folder => {
                      allFolderIds.add(folder.id);
                      if (folder.children && folder.children.length > 0) {
                        collectIds(folder.children);
                      }
                    });
                  };
                  collectIds(filteredFoldersTree);
                  setExpandedFolders(allFolderIds);
                }}
              >
                Expandir Todo
              </button>
              <button 
                className="action-button collapse-all"
                onClick={() => setExpandedFolders(new Set())}
              >
                Colapsar Todo
              </button>
            </div>
          </div>
          {selectedRole && dashboardInfo && (
            <div className="roles-dashboard dashboard-right">
              <div className="dashboard-title">Resumen del rol</div>
              <div className="dashboard-row"><strong>Rol:</strong> <span className="dashboard-role">{selectedRole}</span></div>
              <div className="dashboard-row"><strong>Carpetas con acceso:</strong> {dashboardInfo.totalCarpetasDirectas + dashboardInfo.totalCarpetasHeredadas}</div>
              <div className="dashboard-row"><strong>Permisos directos:</strong> {dashboardInfo.directos}</div>
              <div className="dashboard-row"><strong>Permisos heredados:</strong> {dashboardInfo.heredados}</div>
              <div className="dashboard-row"><strong>Carpetas con permisos directos:</strong></div>
              <ul className="dashboard-folder-list">
                {dashboardInfo.carpetasDirectas.map(carpeta => (
                  <li key={carpeta.id} className="dashboard-folder-item" onClick={() => expandFolderById(carpeta.id)} tabIndex={0} title={carpeta.name}>
                    <span role="img" aria-label="carpeta">📁</span> {carpeta.name}
                  </li>
                ))}
              </ul>
              <div className="dashboard-row"><strong>Carpetas con permisos heredados:</strong></div>
              <ul className="dashboard-folder-list">
                {dashboardInfo.carpetasHeredadas.map(carpeta => (
                  <li key={carpeta.id} className="dashboard-folder-item" onClick={() => expandFolderById(carpeta.id)} tabIndex={0} title={carpeta.name}>
                    <span role="img" aria-label="carpeta">📁</span> {carpeta.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {filteredFoldersTree.length === 0 && (
          <div className="no-folders">
            <div className="no-folders-icon">📁</div>
            <h4>No se encontraron carpetas</h4>
            <p>Este proyecto no tiene carpetas configuradas o no se pudieron cargar</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectFolderTree; 