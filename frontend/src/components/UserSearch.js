import React, { useState, useEffect } from 'react';
import { Search, Users, Mail, Building, UserPlus, X, CheckCircle, Folder, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';
import './UserSearch.css';

const UserSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0
  });

  // Estados para el modal de proyectos
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState(null);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('Todos');
  const [assignStatus, setAssignStatus] = useState(null);
  
  // Estados para el modal de productos ACC
  const [showAccProductsModal, setShowAccProductsModal] = useState(false);
  const [accProjectsToProcess, setAccProjectsToProcess] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState({
    projectAdministration: false,
    designCollaboration: false,
    build: false,
    cost: false,
    modelCoordination: false,
    docs: false,
    autoSpecs: false,
    insight: false,
    takeoff: false
  });
  const [productAccessLevel, setProductAccessLevel] = useState('member'); // 'none', 'member', 'administrator'
  
  // Estados para validación de operaciones
  const [operationCount, setOperationCount] = useState(0);
  const [maxOperations] = useState(50); // Límite de la API de BIM 360

  const searchUsers = async (term = '', offset = 0) => {
    if (!term.trim()) {
      setUsers([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: term,
        limit: pagination.limit.toString(),
        offset: offset.toString()
      });

      const response = await fetch(`https://gestionbim-v6.onrender.com/api/search-users?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Error al buscar usuarios');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setPagination(prev => ({
        ...prev,
        total: data.total || 0,
        offset: offset
      }));
    } catch (err) {
      setError(err.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim()) {
        searchUsers(searchTerm, 0);
      } else {
        setUsers([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleUserSelect = (user) => {
    const isSelected = selectedUsers.find(u => u.id === user.id);
    if (isSelected) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleRemoveSelectedUser = (userId) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const handleClearAllSelected = () => {
    setSelectedUsers([]);
  };

  const handleLoadMore = () => {
    const nextOffset = pagination.offset + pagination.limit;
    searchUsers(searchTerm, nextOffset);
  };

  const handleAssignUsers = () => {
    setShowProjectModal(true);
    loadProjects();
  };

  const loadProjects = async () => {
    setProjectsLoading(true);
    setProjectsError(null);

    try {
      const response = await fetch('https://gestionbim-v6.onrender.com/projects', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Error al cargar proyectos');
      }

      const data = await response.json();
      setProjects(data || []);
    } catch (err) {
      setProjectsError(err.message);
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  const handleProjectToggle = (project) => {
    const alreadySelected = selectedProjects.find(p => p.id === project.id);
    if (alreadySelected) {
      setSelectedProjects(selectedProjects.filter(p => p.id !== project.id));
    } else {
      setSelectedProjects([...selectedProjects, project]);
    }
  };

  const handleConfirmAssignment = async () => {
    if (!selectedProjects.length) return;

    setAssignStatus(null);
    
    // Validar operaciones antes de continuar
    const validation = validateOperations(selectedUsers, selectedProjects);
    if (!validation.valid) {
      setAssignStatus({
        type: 'error',
        message: validation.message
      });
      return;
    }

    // Actualizar contador de operaciones
    setOperationCount(validation.operations.total);
    
    // Separar proyectos por tipo de plataforma
    const bim360Projects = selectedProjects.filter(p => 
      p.platform && p.platform.toLowerCase() === 'bim360'
    );
    const accProjects = selectedProjects.filter(p => 
      p.platform && p.platform.toLowerCase() !== 'bim360'
    );

    // Si hay proyectos ACC, mostrar modal de selección de productos
    if (accProjects.length > 0) {
      setAccProjectsToProcess(accProjects);
      setShowAccProductsModal(true);
      setShowProjectModal(false);
      return;
    }

    // Si solo hay proyectos BIM 360, procesar directamente
    await processBim360Projects(bim360Projects);
  };

  const processBim360Projects = async (bim360Projects) => {
    if (bim360Projects.length === 0) return;

    try {
      // Construir el array de usuarios según la estructura de la API BIM 360
      const usersPayload = selectedUsers.map(user => {
        let roles = user.industry_roles || [];
        if (user.default_role_id && !roles.includes(user.default_role_id)) {
          roles = [user.default_role_id, ...roles];
        }
        return {
          email: user.email,
          services: {
            document_management: { access_level: 'user' }
          },
          company_id: user.company_id || undefined,
          industry_roles: roles,
          default_role_id: user.default_role_id || undefined
        };
      });

      // Enviar la asignación para proyectos BIM 360
      const bim360Res = await fetch('https://gestionbim-v6.onrender.com/api/import-users-to-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          project_ids: bim360Projects.map(p => p.id.startsWith('b.') ? p.id.slice(2) : p.id),
          users: usersPayload
        })
      });
      const bim360Data = await bim360Res.json();
      
      // Mostrar resultado
      const allSuccess = bim360Data.results.every(r => r.success || r.status_code === 202);
      if (allSuccess) {
        setAssignStatus({ 
          type: 'success', 
          message: `Usuarios asignados correctamente a ${bim360Projects.length} proyectos BIM 360.` 
        });
        setShowProjectModal(false);
        setSelectedProjects([]);
        setSelectedUsers([]);
      } else {
        const successCount = bim360Data.results.filter(r => r.success || r.status_code === 202).length;
        const errorCount = bim360Data.results.length - successCount;
        setAssignStatus({ 
          type: 'error', 
          message: `Se completaron ${successCount} de ${bim360Data.results.length} asignaciones BIM 360. ${errorCount} proyectos tuvieron errores.` 
        });
      }
    } catch (err) {
      setAssignStatus({ type: 'error', message: err.message || 'Error inesperado al asignar usuarios.' });
    }
  };

  const handleCloseModal = () => {
    setShowProjectModal(false);
    setSelectedProjects([]);
  };

  // Obtener plataformas únicas para el filtro
  const platforms = React.useMemo(() => {
    const set = new Set(projects.map(p => p.platform || 'Desconocido'));
    return ['Todos', ...Array.from(set)];
  }, [projects]);

  // Filtrar proyectos por plataforma y búsqueda
  const filteredProjects = projects.filter(project => {
    const matchesPlatform = platformFilter === 'Todos' || (project.platform === platformFilter);
    const matchesSearch =
      project.name?.toLowerCase().includes(projectSearchTerm.toLowerCase()) ||
      project.projectNumber?.toLowerCase().includes(projectSearchTerm.toLowerCase());
    return matchesPlatform && matchesSearch;
  });

  const processAccProjects = async () => {
    try {
      // Construir el array de productos basado en la selección del usuario
      const selectedProductKeys = Object.entries(selectedProducts)
        .filter(([key, selected]) => selected)
        .map(([key, selected]) => key);

      if (selectedProductKeys.length === 0) {
        setAssignStatus({ 
          type: 'warning', 
          message: 'Debes seleccionar al menos un producto para continuar.' 
        });
        return;
      }

      // Verificar si projectAdministration está seleccionado
      const hasProjectAdmin = selectedProductKeys.includes('projectAdministration');
      
      // Aplicar reglas especiales según la documentación de ACC
      let finalAccessLevel = productAccessLevel;
      
      if (hasProjectAdmin) {
        if (productAccessLevel === 'none') {
          // Si projectAdministration es 'none', todos los demás productos deben ser 'member'
          finalAccessLevel = 'member';
        } else if (productAccessLevel === 'member') {
          // No se puede establecer projectAdministration en 'member'
          setAssignStatus({ 
            type: 'warning', 
            message: 'No se puede establecer Administración de Proyecto en nivel "Miembro". Usa "Sin Acceso" o "Administrador".' 
          });
          return;
        }
        // Si es 'administrator', se mantiene igual
      }

      // Construir el array de productos con el nivel de acceso correcto
      const products = selectedProductKeys.map(key => ({
        key: key,
        access: finalAccessLevel
      }));

      // Construir el array de usuarios según la estructura de la API ACC
      const usersPayload = selectedUsers.map(user => {
        // Extraer nombre y apellido del nombre completo
        const nameParts = (user.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Mantener el roleId como en BIM 360
        let roleIds = user.industry_roles || [];
        if (user.default_role_id && !roleIds.includes(user.default_role_id)) {
          roleIds = [user.default_role_id, ...roleIds];
        }

        return {
          firstName: firstName,
          lastName: lastName,
          email: user.email,
          companyId: user.company_id || undefined,
          roleIds: roleIds,
          products: products
        };
      });

      // Enviar la asignación para proyectos ACC
      const accRes = await fetch('https://gestionbim-v6.onrender.com/api/import-users-to-acc-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          project_ids: accProjectsToProcess.map(p => p.id.startsWith('b.') ? p.id.slice(2) : p.id),
          users: usersPayload
        })
      });
      const accData = await accRes.json();
      
      // Verificar si hay proyectos BIM 360 que también necesitan procesarse
      const remainingProjects = selectedProjects.filter(p => 
        !accProjectsToProcess.find(accP => accP.id === p.id)
      );
      const remainingBim360Projects = remainingProjects.filter(p => 
        p.platform && p.platform.toLowerCase() === 'bim360'
      );

      // Procesar proyectos BIM 360 restantes si los hay
      if (remainingBim360Projects.length > 0) {
        await processBim360Projects(remainingBim360Projects);
      }

      // Mostrar resultado
      const allSuccess = accData.results.every(r => r.success || r.status_code === 202);
      if (allSuccess) {
        setAssignStatus({ 
          type: 'success', 
          message: `Usuarios asignados correctamente a ${accProjectsToProcess.length} proyectos ACC${remainingBim360Projects.length > 0 ? ` y ${remainingBim360Projects.length} proyectos BIM 360` : ''}.` 
        });
        setShowAccProductsModal(false);
        setSelectedProjects([]);
        setSelectedUsers([]);
        setAccProjectsToProcess([]);
        setSelectedProducts({
          projectAdministration: false,
          designCollaboration: false,
          build: false,
          cost: false,
          modelCoordination: false,
          docs: false,
          autoSpecs: false,
          insight: false,
          takeoff: false
        });
      } else {
        const successCount = accData.results.filter(r => r.success || r.status_code === 202).length;
        const errorCount = accData.results.length - successCount;
        setAssignStatus({ 
          type: 'error', 
          message: `Se completaron ${successCount} de ${accData.results.length} asignaciones ACC. ${errorCount} proyectos tuvieron errores.` 
        });
      }
    } catch (err) {
      setAssignStatus({ type: 'error', message: err.message || 'Error inesperado al asignar usuarios.' });
    }
  };

  const handleCloseAccProductsModal = () => {
    setShowAccProductsModal(false);
    setAccProjectsToProcess([]);
    setSelectedProducts({
      projectAdministration: false,
      designCollaboration: false,
      build: false,
      cost: false,
      modelCoordination: false,
      docs: false,
      autoSpecs: false,
      insight: false,
      takeoff: false
    });
  };

  const processMixedProjects = async (bim360Projects, accProjects) => {
    const results = [];

    // Procesar proyectos BIM 360
    if (bim360Projects.length > 0) {
      await processBim360Projects(bim360Projects);
    }

    // Procesar proyectos ACC
    if (accProjects.length > 0) {
      await processAccProjects();
    }
  };

  // Función para calcular operaciones
  const calculateOperations = (users, projects) => {
    const bim360Projects = projects.filter(p => 
      p.platform && p.platform.toLowerCase() === 'bim360'
    );
    const accProjects = projects.filter(p => 
      p.platform && p.platform.toLowerCase() !== 'bim360'
    );
    
    // Para BIM 360: usuarios × proyectos = operaciones
    const bim360Operations = users.length * bim360Projects.length;
    
    // Para ACC: usuarios × proyectos = operaciones (pero se procesan por separado)
    const accOperations = users.length * accProjects.length;
    
    return {
      total: bim360Operations + accOperations,
      bim360: bim360Operations,
      acc: accOperations,
      bim360Projects: bim360Projects.length,
      accProjects: accProjects.length
    };
  };

  // Función para validar operaciones
  const validateOperations = (users, projects) => {
    const operations = calculateOperations(users, projects);
    
    if (operations.bim360 > maxOperations) {
      return {
        valid: false,
        message: `Excedes el límite de ${maxOperations} operaciones para BIM 360. Tienes ${operations.bim360} operaciones (${users.length} usuarios × ${operations.bim360Projects} proyectos). Reduce usuarios o proyectos.`
      };
    }
    
    return {
      valid: true,
      operations: operations
    };
  };

  return (
    <div className="user-search-container">
      {/* Notificaciones de estado - Fuera del modal */}
      {assignStatus && (
        <div className={`status-notification ${assignStatus.type}`}>
          {assignStatus.type === 'success' && <CheckCircle2 size={18} />} 
          {assignStatus.type === 'error' && <AlertTriangle size={18} />} 
          {assignStatus.type === 'warning' && <AlertTriangle size={18} />} 
          <span>{assignStatus.message}</span>
          <button 
            className="close-notification"
            onClick={() => setAssignStatus(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="main-content">
        {/* Barra de búsqueda */}
        <div className="search-section">
          <div className="search-header">
            <h3>Buscar Usuarios</h3>
            <p>Encuentra usuarios en tu cuenta BIM 360/ACC</p>
          </div>
          
          <div className="search-input-container">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre, email o empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {/* Resultados de búsqueda */}
        <div className="results-section">
          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <p>Buscando usuarios...</p>
            </div>
          )}

          {error && (
            <div className="error">
              <p>Error: {error}</p>
            </div>
          )}

          {!loading && !error && users.length > 0 && (
            <>
              <div className="results-header">
                <h4>Resultados ({pagination.total} usuarios encontrados)</h4>
                {selectedUsers.length > 0 && (
                  <button 
                    className="assign-button"
                    onClick={handleAssignUsers}
                  >
                    <UserPlus size={16} />
                    Asignar {selectedUsers.length} usuarios
                  </button>
                )}
              </div>

              <div className="users-grid">
                {users.map((user) => {
                  const isSelected = selectedUsers.find(u => u.id === user.id);
                  return (
                    <div 
                      key={user.id} 
                      className={`user-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleUserSelect(user)}
                    >
                      <div className="user-avatar">
                        {user.image_url ? (
                          <img src={user.image_url} alt={user.name} />
                        ) : (
                          <Users size={24} />
                        )}
                      </div>
                      
                      <div className="user-info">
                        <h5 className="user-name">{user.name}</h5>
                        <p className="user-email">
                          <Mail size={14} />
                          {user.email}
                        </p>
                        {user.company_name && (
                          <p className="user-company">
                            <Building size={14} />
                            {user.company_name}
                          </p>
                        )}
                        {user.job_title && (
                          <p className="user-job">{user.job_title}</p>
                        )}
                      </div>

                      <div className="user-status">
                        {isSelected ? (
                          <CheckCircle size={20} className="selected-icon" />
                        ) : (
                          <span className={`status-badge ${user.status}`}>
                            {user.status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paginación */}
              {pagination.total > pagination.limit && (
                <div className="pagination">
                  <button 
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="load-more-button"
                  >
                    Cargar más usuarios
                  </button>
                  <p className="pagination-info">
                    Mostrando {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} de {pagination.total}
                  </p>
                </div>
              )}
            </>
          )}

          {!loading && !error && searchTerm && users.length === 0 && (
            <div className="no-results">
              <Users size={48} />
              <h4>No se encontraron usuarios</h4>
              <p>Intenta con otros términos de búsqueda</p>
            </div>
          )}
        </div>
      </div>

      {/* Panel lateral de usuarios seleccionados */}
      <div className="selected-users-panel">
        <div className="panel-header">
          <h3>Usuarios Seleccionados</h3>
          <span className="selected-count">{selectedUsers.length}</span>
          {selectedUsers.length > 0 && (
            <button 
              className="clear-all-button"
              onClick={handleClearAllSelected}
            >
              <X size={16} />
              Limpiar
            </button>
          )}
        </div>

        <div className="selected-users-list">
          {selectedUsers.length === 0 ? (
            <div className="empty-selection">
              <Users size={32} />
              <p>No hay usuarios seleccionados</p>
              <span>Haz clic en los usuarios para seleccionarlos</span>
            </div>
          ) : (
            selectedUsers.map((user) => (
              <div key={user.id} className="selected-user-item">
                <div className="selected-user-avatar">
                  {user.image_url ? (
                    <img src={user.image_url} alt={user.name} />
                  ) : (
                    <Users size={16} />
                  )}
                </div>
                
                <div className="selected-user-info">
                  <h5 className="selected-user-name">{user.name}</h5>
                  <p className="selected-user-email">{user.email}</p>
                  {user.company_name && (
                    <p className="selected-user-company">{user.company_name}</p>
                  )}
                </div>

                <button 
                  className="remove-user-button"
                  onClick={() => handleRemoveSelectedUser(user.id)}
                >
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {selectedUsers.length > 0 && (
          <div className="panel-footer">
            <button 
              className="assign-all-button"
              onClick={handleAssignUsers}
            >
              <UserPlus size={16} />
              Asignar {selectedUsers.length} usuarios
            </button>
          </div>
        )}
      </div>

      {/* Modal de selección de proyecto */}
      {showProjectModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="project-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Seleccionar Proyectos</h3>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-content">
              <div className="project-search-section">
                <div className="search-input-container">
                  <Search className="search-icon" size={20} />
                  <input
                    type="text"
                    placeholder="Buscar proyectos..."
                    value={projectSearchTerm}
                    onChange={(e) => setProjectSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
                {/* Filtro por plataforma */}
                <div className="platform-filter">
                  <label htmlFor="platform-select">Plataforma:</label>
                  <select
                    id="platform-select"
                    value={platformFilter}
                    onChange={e => setPlatformFilter(e.target.value)}
                  >
                    {platforms.map(platform => (
                      <option key={platform} value={platform}>{platform}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="project-selection-info">
                <p>Selecciona los proyectos donde quieres asignar <strong>{selectedUsers.length} usuarios</strong></p>
                <p className="selected-projects-count">Proyectos seleccionados: <strong>{selectedProjects.length}</strong></p>
                
                {/* Botón para seleccionar todos los proyectos filtrados */}
                {filteredProjects.length > 0 && (
                  <div className="select-all-section">
                    <button 
                      className="select-all-button"
                      onClick={() => {
                        // Obtener IDs de proyectos ya seleccionados
                        const selectedIds = selectedProjects.map(p => p.id);
                        
                        // Agregar solo los proyectos que no están ya seleccionados
                        const newProjects = filteredProjects.filter(project => 
                          !selectedIds.includes(project.id)
                        );
                        
                        setSelectedProjects([...selectedProjects, ...newProjects]);
                      }}
                      disabled={filteredProjects.every(project => 
                        selectedProjects.find(p => p.id === project.id)
                      )}
                    >
                      <CheckCircle size={16} />
                      Seleccionar todos los proyectos filtrados ({filteredProjects.length})
                    </button>
                    
                    {selectedProjects.length > 0 && (
                      <button 
                        className="deselect-all-button"
                        onClick={() => setSelectedProjects([])}
                      >
                        <X size={16} />
                        Deseleccionar todos
                      </button>
                    )}
                  </div>
                )}
                
                {/* Contador de operaciones */}
                {selectedUsers.length > 0 && selectedProjects.length > 0 && (
                  <div className="operations-counter">
                    {(() => {
                      const operations = calculateOperations(selectedUsers, selectedProjects);
                      const bim360Projects = selectedProjects.filter(p => 
                        p.platform && p.platform.toLowerCase() === 'bim360'
                      );
                      const accProjects = selectedProjects.filter(p => 
                        p.platform && p.platform.toLowerCase() !== 'bim360'
                      );
                      
                      return (
                        <div className={`operations-info ${operations.bim360 > maxOperations ? 'exceeded' : ''}`}>
                          <p><strong>Operaciones a realizar:</strong></p>
                          <ul>
                            {operations.bim360 > 0 && (
                              <li className={operations.bim360 > maxOperations ? 'exceeded' : ''}>
                                BIM 360: {operations.bim360} operaciones ({selectedUsers.length} usuarios × {bim360Projects.length} proyectos)
                                {operations.bim360 > maxOperations && (
                                  <span className="limit-warning"> ⚠️ Excede el límite de {maxOperations}</span>
                                )}
                              </li>
                            )}
                            {operations.acc > 0 && (
                              <li>
                                ACC: {operations.acc} operaciones ({selectedUsers.length} usuarios × {accProjects.length} proyectos)
                              </li>
                            )}
                            <li className="total-operations">
                              <strong>Total: {operations.total} operaciones</strong>
                            </li>
                          </ul>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="projects-list">
                {projectsLoading && (
                  <div className="loading">
                    <div className="spinner"></div>
                    <p>Cargando proyectos...</p>
                  </div>
                )}

                {projectsError && (
                  <div className="error">
                    <p>Error: {projectsError}</p>
                  </div>
                )}

                {!projectsLoading && !projectsError && filteredProjects.length > 0 && (
                  filteredProjects.map((project) => {
                    const isSelected = selectedProjects.find(p => p.id === project.id);
                    return (
                      <div 
                        key={project.id} 
                        className={`project-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleProjectToggle(project)}
                      >
                        <div className="project-icon">
                          <Folder size={24} />
                        </div>
                        
                        <div className="project-info">
                          <h5 className="project-name">{project.name}</h5>
                          {project.projectNumber && (
                            <p className="project-number">
                              <span className="label">Número:</span> {project.projectNumber}
                            </p>
                          )}
                          {project.status && (
                            <p className="project-status">
                              <span className="label">Estado:</span> 
                              <span className={`status-badge ${project.status.toLowerCase()}`}>
                                {project.status}
                              </span>
                            </p>
                          )}
                          {project.startDate && (
                            <p className="project-date">
                              <span className="label">Inicio:</span> {new Date(project.startDate).toLocaleDateString()}
                            </p>
                          )}
                          {/* Mostrar plataforma */}
                          {project.platform && (
                            <p className={`project-platform platform-${project.platform.toLowerCase()}`}>
                              <span className="label">Plataforma:</span> 
                              <span className="platform-badge">{project.platform}</span>
                            </p>
                          )}
                        </div>

                        <div className="project-status-indicator">
                          {isSelected ? (
                            <CheckCircle size={20} className="selected-icon" />
                          ) : (
                            <MapPin size={20} />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {!projectsLoading && !projectsError && filteredProjects.length === 0 && (
                  <div className="no-results">
                    <Folder size={48} />
                    <h4>No se encontraron proyectos</h4>
                    <p>Intenta con otros términos de búsqueda</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="modal-button secondary"
                onClick={handleCloseModal}
              >
                Cancelar
              </button>
              <button 
                className="modal-button primary"
                onClick={handleConfirmAssignment}
                disabled={!selectedProjects.length || (() => {
                  const operations = calculateOperations(selectedUsers, selectedProjects);
                  return operations.bim360 > maxOperations;
                })()}
              >
                <UserPlus size={16} />
                Asignar {selectedUsers.length} usuarios a {selectedProjects.length} proyectos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de selección de productos ACC */}
      {showAccProductsModal && (
        <div className="modal-overlay" onClick={handleCloseAccProductsModal}>
          <div className="acc-products-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Configurar Productos ACC</h3>
              <button className="modal-close" onClick={handleCloseAccProductsModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-content">
              <div className="acc-info">
                <p>Selecciona los productos de Autodesk Construction Cloud que quieres habilitar para <strong>{selectedUsers.length} usuarios</strong> en <strong>{accProjectsToProcess.length} proyectos ACC</strong>.</p>
              </div>

              <div className="access-level-section">
                <h4>Nivel de Acceso</h4>
                <div className="access-level-options">
                  <label className="access-option">
                    <input
                      type="radio"
                      name="accessLevel"
                      value="none"
                      checked={productAccessLevel === 'none'}
                      onChange={(e) => setProductAccessLevel(e.target.value)}
                    />
                    <span>Sin Acceso</span>
                  </label>
                  <label className="access-option">
                    <input
                      type="radio"
                      name="accessLevel"
                      value="member"
                      checked={productAccessLevel === 'member'}
                      onChange={(e) => setProductAccessLevel(e.target.value)}
                    />
                    <span>Miembro</span>
                  </label>
                  <label className="access-option">
                    <input
                      type="radio"
                      name="accessLevel"
                      value="administrator"
                      checked={productAccessLevel === 'administrator'}
                      onChange={(e) => setProductAccessLevel(e.target.value)}
                    />
                    <span>Administrador de proyecto</span>
                  </label>
                </div>
              </div>

              <div className="products-section">
                <h4>Productos Disponibles</h4>
                <div className="products-grid">
                  {Object.entries({
                    projectAdministration: 'Administración de Proyecto',
                    designCollaboration: 'Design Collaboration',
                    build: 'Build',
                    cost: 'Cost Management',
                    modelCoordination: 'Model Coordination',
                    docs: 'Docs',
                    autoSpecs: 'AutoSpecs',
                    insight: 'Insights',
                    takeoff: 'Takeoff'
                  }).map(([key, label]) => (
                    <label key={key} className="product-option">
                      <input
                        type="checkbox"
                        checked={selectedProducts[key]}
                        onChange={(e) => setSelectedProducts(prev => ({
                          ...prev,
                          [key]: e.target.checked
                        }))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="modal-button secondary"
                onClick={handleCloseAccProductsModal}
              >
                Cancelar
              </button>
              <button 
                className="modal-button primary"
                onClick={processAccProjects}
                disabled={Object.values(selectedProducts).every(selected => !selected)}
              >
                <UserPlus size={16} />
                Asignar Usuarios a ACC
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSearch; 