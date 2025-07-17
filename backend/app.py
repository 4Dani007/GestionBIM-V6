from flask import Flask, redirect, request, session, url_for, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
import json
from datetime import datetime, timedelta

# Cargar las variables de entorno desde el archivo .env
load_dotenv()

app = Flask(__name__)
CORS(app, supports_credentials=True)
app.secret_key = os.urandom(24)

# Cargar las credenciales de Autodesk desde el archivo .env
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI")
AUTH_URL = "https://developer.api.autodesk.com/authentication/v2/authorize"
TOKEN_URL = "https://developer.api.autodesk.com/authentication/v2/token"
SCOPES = "data:read account:read account:write"
ACCOUNT_ID = os.getenv("ACCOUNT_ID")
HUB_ID = os.getenv("HUB_ID")

@app.route('/')
def home():
    return '<a href="/login">Autenticar con Autodesk</a>'

@app.route('/login')
def login():
    auth_url = (
        f"{AUTH_URL}?response_type=code&client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&scope={SCOPES}"
    )
    return redirect(auth_url)

@app.route('/callback')
def callback():
    code = request.args.get('code')
    if not code:
        return "Error: No se recibió el código de autorización."
    
    token_response = requests.post(
        TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
        },
    )
    
    token_data = token_response.json()
    session['access_token'] = token_data.get('access_token')
    
    # Redirigir al frontend (http://localhost:3000/) - cambiar en produccion
    return redirect("https://gestionbim-v6-1.onrender.com")

@app.route('/profile')
def profile():
    access_token = session.get('access_token')
    if not access_token:
        return redirect(url_for('login'))
    
    headers = {"Authorization": f"Bearer {access_token}"}
    user_info = requests.get("https://developer.api.autodesk.com/userprofile/v1/users/@me", headers=headers)
    
    return user_info.json()

@app.route('/projects', methods=['GET'])
def projects():
    """Obtiene todos los proyectos disponibles."""
    access_token = session.get('access_token')
    if not access_token:
        return jsonify({"error": "No hay un token de acceso. Inicia sesión."}), 401
    
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"https://developer.api.autodesk.com/construction/admin/v1/accounts/{ACCOUNT_ID}/projects"
    all_projects = []

    while url:
        response = requests.get(url, headers=headers)  # Usar headers locales
        if response.status_code != 200:
            return jsonify({"error": "No se pudieron obtener los proyectos"}), 500

        data = response.json()
        all_projects.extend(data.get("results", []))
        url = data.get("pagination", {}).get("nextUrl")

    return jsonify(all_projects)

@app.route('/api/check-auth')
def check_auth():
    access_token = session.get('access_token')
    if not access_token:
        return jsonify({"authenticated": False}), 401
    
    headers = {"Authorization": f"Bearer {access_token}"}
    user_info = requests.get("https://developer.api.autodesk.com/userprofile/v1/users/@me", headers=headers)
    
    if user_info.status_code != 200:
        return jsonify({"authenticated": False}), 401
    
    return jsonify({"authenticated": True, "user": user_info.json()})

@app.route('/api/test-auth', methods=['GET'])
def test_auth():
    """Endpoint de prueba para verificar autenticación y variables de entorno."""
    access_token = session.get('access_token')
    if not access_token:
        return jsonify({"error": "No hay un token de acceso. Inicia sesión."}), 401
    
    return jsonify({
        "authenticated": True,
        "account_id": ACCOUNT_ID,
        "hub_id": HUB_ID,
        "token_length": len(access_token) if access_token else 0
    })

@app.route('/api/get-token', methods=['GET'])
def get_token():
    """Obtiene el token de acceso actual de la sesión."""
    access_token = session.get('access_token')
    if not access_token:
        return jsonify({"error": "No hay un token de acceso. Inicia sesión."}), 401
    
    return jsonify({
        "token": access_token,
        "token_length": len(access_token)
    })

@app.route('/api/search-users', methods=['GET'])
def search_users():
    """Busca usuarios en la cuenta de Autodesk Construction Cloud (ACC) usando la API de HQ."""
    # Obtener token de la sesión o del header de autorización
    access_token = session.get('access_token')
    
    # Si no hay token en la sesión, intentar obtenerlo del header
    if not access_token:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            access_token = auth_header.split(' ')[1]
    
    if not access_token:
        return jsonify({"error": "No hay un token de acceso. Inicia sesión."}), 401
    
    # Obtener un token de 2 patas para la API de HQ
    try:
        token_response = requests.post(
            "https://developer.api.autodesk.com/authentication/v2/token",
            data={
                "grant_type": "client_credentials",
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "scope": "data:read account:read"
            }
        )
        
        if token_response.status_code != 200:
            return jsonify({"error": "No se pudo obtener el token de aplicación"}), 500
        
        two_legged_token = token_response.json().get("access_token")
        headers = {"Authorization": f"Bearer {two_legged_token}"}
        
    except Exception as e:
        print(f"Error obteniendo token de 2 patas: {e}")
        return jsonify({"error": "Error obteniendo token de aplicación"}), 500
    
    # Parámetros de búsqueda
    search_term = request.args.get('q', '')  # Término de búsqueda
    email = request.args.get('email', '')    # Email específico
    name = request.args.get('name', '')      # Nombre específico
    limit = request.args.get('limit', '50')  # Límite de resultados
    offset = request.args.get('offset', '0') # Offset para paginación
    
    # Construir la URL base - Usar la API correcta de HQ
    # Extraer el account_id sin el prefijo 'b.'
    account_id_clean = ACCOUNT_ID.replace('b.', '') if ACCOUNT_ID.startswith('b.') else ACCOUNT_ID
    url = f"https://developer.api.autodesk.com/hq/v1/accounts/{account_id_clean}/users/search"
    
    # Construir parámetros de consulta
    params = {}
    
    # Agregar parámetros de búsqueda si están presentes
    if search_term:
        params['name'] = search_term
    elif name:
        params['name'] = name
    elif email:
        params['email'] = email

    try:
        response = requests.get(url, headers=headers, params=params)
        
        # Debug: imprimir información de la respuesta
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {response.headers}")
        print(f"URL: {response.url}")
        
        if response.status_code != 200:
            print(f"Error Response: {response.text}")
            return jsonify({"error": f"Error de API: {response.status_code} - {response.text}"}), response.status_code
        
        data = response.json()
        print(f"Response Data: {data}")
        
        # Formatear la respuesta para incluir información relevante
        formatted_users = []
        users_data = data if isinstance(data, list) else data.get("results", [])
        
        for user in users_data:
            formatted_users.append({
                "id": user.get("id") or user.get("userId"),
                "email": user.get("email") or user.get("emailId"),
                "name": user.get("name") or f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
                "first_name": user.get("firstName"),
                "last_name": user.get("lastName"),
                "nickname": user.get("nickname"),
                "status": user.get("status", "active"),
                "image_url": user.get("imageUrl") or user.get("profileImages", {}).get("sizeX80"),
                "company_id": user.get("company_id"),
                "company_name": user.get("company_name"),
                "job_title": user.get("jobTitle"),
                "phone": user.get("phone") or user.get("phoneNumber"),
                "address": user.get("address") or user.get("addressLine1"),
                "city": user.get("city"),
                "state": user.get("state") or user.get("stateOrProvince"),
                "postal_code": user.get("postalCode") or user.get("zipCode"),
                "country": user.get("country") or user.get("countryCode"),
                "industry": user.get("industry"),
                "about": user.get("about") or user.get("aboutMe"),
                "created_at": user.get("createdAt") or user.get("createdDate"),
                "default_role_id": user.get("default_role_id"),
                "updated_at": user.get("updatedAt") or user.get("lastModifiedDate")
            })
        
        return jsonify({
            "total": len(formatted_users),
            "limit": int(limit),
            "offset": int(offset),
            "users": formatted_users,
            "pagination": {}
        })
        
    except requests.exceptions.RequestException as e:
        print(f"Error al buscar usuarios: {e}")
        return jsonify({"error": f"No se pudieron buscar usuarios: {str(e)}"}), 500
    except Exception as e:
        print(f"Error inesperado: {e}")
        return jsonify({"error": f"Error inesperado: {str(e)}"}), 500

@app.route('/project-folders', methods=['GET'])
def get_project_folders():
    """Obtiene las carpetas principales de un proyecto específico."""
    project_id = request.args.get('project_id')
    access_token = session.get('access_token')
    if not access_token:
        return jsonify({"error": "No hay un token de acceso. Inicia sesión."}), 401
    
    headers = {"Authorization": f"Bearer {access_token}"}

    if not project_id:
        return jsonify({"error": "Se requiere un project_id"}), 400

    url = f"https://developer.api.autodesk.com/project/v1/hubs/{HUB_ID}/projects/b.{project_id}/topFolders"

    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        return jsonify({"error": "No se pudieron obtener las carpetas del proyecto"}), 500

    folders = response.json().get("data", [])
    project_folder = next(
        (folder for folder in folders if folder["attributes"]["name"].lower() in ["archivos de proyecto", "project files"]),
        None
    )

    return jsonify({"folder_id": project_folder["id"] if project_folder else None})

@app.route('/subfolders', methods=['GET'])
def get_subfolders():
    """Obtiene las subcarpetas de una carpeta específica."""
    folder_id = request.args.get('folder_id')
    project_id = request.args.get('project_id')
    access_token = session.get('access_token')
    if not access_token:
        return jsonify({"error": "No hay un token de acceso. Inicia sesión."}), 401
    
    headers = {"Authorization": f"Bearer {access_token}"}

    if not folder_id or not project_id:
        return jsonify({"error": "Se requieren folder_id y project_id"}), 400

    url = f"https://developer.api.autodesk.com/data/v1/projects/b.{project_id}/folders/{folder_id}/contents"

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        folders = response.json().get("data", [])

        return jsonify([
            {"id": folder["id"], "name": folder["attributes"]["name"]}
            for folder in folders if folder["type"] == "folders"
        ])
    except requests.exceptions.RequestException as e:
        print(f"Error al obtener subcarpetas: {e}")
        return jsonify({"error": "No se pudieron obtener las subcarpetas"}), 500

@app.route("/api/permissions", methods=["GET"])
def get_permissions():
    """Devuelve los permisos de una carpeta específica."""
    folder_urn = request.args.get("urn")
    project_id = request.args.get("project_id")
    access_token = session.get('access_token')
    if not access_token:
        return jsonify({"error": "No hay un token de acceso. Inicia sesión."}), 401
    
    headers = {"Authorization": f"Bearer {access_token}"}

    if not folder_urn or not project_id:
        return jsonify({"error": "Se requieren project_id y urn"}), 400

    url = f"https://developer.api.autodesk.com/bim360/docs/v1/projects/b.{project_id}/folders/{folder_urn}/permissions"

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        print(f"Error al obtener permisos: {e}")
        return jsonify({"error": "No se pudieron obtener los permisos"}), 500

@app.route("/api/functions", methods=["GET"])
def get_functions():
    """Obtiene las funciones disponibles en un proyecto."""
    project_id = request.args.get("project_id")
    access_token = session.get('access_token')
    if not access_token:
        return jsonify({"error": "No hay un token de acceso. Inicia sesión."}), 401
    
    headers = {"Authorization": f"Bearer {access_token}"}

    if not project_id:
        return jsonify({"error": "Se requiere project_id"}), 400

    # Obtener las funciones del proyecto
    url = f"https://developer.api.autodesk.com/construction/admin/v1/accounts/{ACCOUNT_ID}/projects/{project_id}/functions"

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        functions = response.json()
        
        # Formatear la respuesta para incluir información relevante
        formatted_functions = []
        for function in functions.get("results", []):
            formatted_functions.append({
                "id": function.get("id"),
                "name": function.get("name"),
                "description": function.get("description"),
                "type": function.get("type"),
                "status": function.get("status"),
                "created_at": function.get("createdAt"),
                "updated_at": function.get("updatedAt")
            })
        
        return jsonify({
            "total": len(formatted_functions),
            "functions": formatted_functions
        })
    except requests.exceptions.RequestException as e:
        print(f"Error al obtener funciones: {e}")
        return jsonify({"error": "No se pudieron obtener las funciones"}), 500

@app.route('/api/import-users-to-project', methods=['POST'])
def import_users_to_project():
    """Importa usuarios a uno o varios proyectos BIM 360 usando la API oficial de Autodesk (solo BIM 360)."""
    access_token = session.get('access_token')
    if not access_token:
        return jsonify({"error": "No hay un token de acceso. Inicia sesión."}), 401

    data = request.get_json()
    project_ids = data.get('project_ids')
    users = data.get('users')

    # Compatibilidad retro: si solo viene project_id, convertir a lista
    if not project_ids:
        project_id = data.get('project_id')
        if project_id:
            project_ids = [project_id]

    if not project_ids or not users:
        return jsonify({"error": "Faltan parámetros obligatorios (project_ids, users)"}), 400

    results = []
    for project_id in project_ids:
        # El project_id debe venir sin el prefijo 'b.'
        if project_id.startswith('b.'):
            project_id_clean = project_id[2:]
        else:
            project_id_clean = project_id
        url = f"https://developer.api.autodesk.com/hq/v2/accounts/{ACCOUNT_ID}/projects/{project_id_clean}/users/import"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        try:
            response = requests.post(url, headers=headers, json=users)
            if response.status_code in (200, 201):
                results.append({
                    "project_id": project_id,
                    "success": True,
                    "result": response.json()
                })
            else:
                results.append({
                    "project_id": project_id,
                    "success": False,
                    "status_code": response.status_code,
                    "error": response.text
                })
        except Exception as e:
            results.append({
                "project_id": project_id,
                "success": False,
                "error": str(e)
            })
    # Si todos fueron exitosos, success general True
    all_success = all(r.get('success') for r in results)
    return jsonify({"success": all_success, "results": results}), 200 if all_success else 207



@app.route('/api/project-folders-tree', methods=['GET'])
def get_project_folders_tree():
    """Obtiene todas las carpetas y subcarpetas del proyecto en estructura de árbol, usando caché local por proyecto."""
    access_token = session.get('access_token')
    if not access_token:
        return jsonify({"error": "No hay un token de acceso. Inicia sesión."}), 401
    
    project_id = request.args.get('project_id')
    force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
    if not project_id:
        return jsonify({"error": "Se requiere el ID del proyecto"}), 400
    
    headers = {"Authorization": f"Bearer {access_token}"}
    cache_dir = os.path.join(os.path.dirname(__file__), 'cache')
    os.makedirs(cache_dir, exist_ok=True)
    cache_file = os.path.join(cache_dir, f"folders_{project_id}.json")

    # Leer caché si existe y no se fuerza actualización
    if os.path.exists(cache_file) and not force_refresh:
        with open(cache_file, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
        # Devolver los datos del caché, incluyendo la fecha
        return jsonify({
            "project_id": project_id,
            "updatedAt": cache_data.get("updatedAt"),
            "total_folders": cache_data.get("total_folders"),
            "folders": cache_data.get("folders", []),
            "from_cache": True
        })

    def get_folder_permissions(folder_id, project_id):
        """Obtiene los permisos de una carpeta específica."""
        try:
            # El folder_id es el URN de la carpeta
            url = f"https://developer.api.autodesk.com/bim360/docs/v1/projects/b.{project_id}/folders/{folder_id}/permissions"
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Error obteniendo permisos de carpeta {folder_id}: {response.status_code}")
                return {"error": f"No se pudieron obtener los permisos ({response.status_code})"}
        except Exception as e:
            print(f"Error obteniendo permisos de carpeta {folder_id}: {e}")
            return {"error": str(e)}
    
    def get_folder_contents(folder_id, project_id, path=""):
        """Función recursiva para obtener el contenido de una carpeta y sus permisos."""
        try:
            # Construir la URL para obtener el contenido de la carpeta
            project_id_with_prefix = f"b.{project_id}" if not project_id.startswith('b.') else project_id
            url = f"https://developer.api.autodesk.com/data/v1/projects/{project_id_with_prefix}/folders/{folder_id}/contents"
            response = requests.get(url, headers=headers)
            
            if response.status_code != 200:
                print(f"Error obteniendo contenido de carpeta {folder_id}: {response.status_code}")
                return []
            
            data = response.json().get("data", [])
            folders = []
            
            for item in data:
                if item["type"] == "folders":
                    # Obtener permisos de la carpeta
                    permissions = get_folder_permissions(item["id"], project_id)
                    folder_info = {
                        "id": item["id"],
                        "name": item["attributes"]["name"],
                        "path": f"{path}/{item['attributes']['name']}" if path else item['attributes']['name'],
                        "type": "folder",
                        "permissions": permissions,
                        "children": []
                    }
                    # Obtener subcarpetas recursivamente
                    subfolders = get_folder_contents(
                        item["id"], 
                        project_id, 
                        folder_info["path"]
                    )
                    folder_info["children"] = subfolders
                    folders.append(folder_info)
            return folders
        except Exception as e:
            print(f"Error procesando carpeta {folder_id}: {e}")
            return []
    try:
        project_id_with_prefix = f"b.{project_id}" if not project_id.startswith('b.') else project_id
        top_folders_url = f"https://developer.api.autodesk.com/project/v1/hubs/{HUB_ID}/projects/{project_id_with_prefix}/topFolders"
        top_response = requests.get(top_folders_url, headers=headers)
        if top_response.status_code != 200:
            print(f"Error obteniendo carpetas principales: {top_response.status_code} - {top_response.text}")
            return jsonify({"error": "No se pudieron obtener las carpetas principales del proyecto"}), 500
        top_folders_data = top_response.json().get("data", [])
        all_folders = []
        for top_folder in top_folders_data:
            # Obtener permisos de la carpeta principal
            permissions = get_folder_permissions(top_folder["id"], project_id)
            folder_info = {
                "id": top_folder["id"],
                "name": top_folder["attributes"]["name"],
                "path": top_folder["attributes"]["name"],
                "type": "folder",
                "permissions": permissions,
                "children": []
            }
            # Obtener subcarpetas recursivamente
            subfolders = get_folder_contents(
                top_folder["id"], 
                project_id, 
                folder_info["path"]
            )
            folder_info["children"] = subfolders
            all_folders.append(folder_info)
        updatedAt = datetime.utcnow().isoformat() + 'Z'
        # Guardar en caché
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump({
                "project_id": project_id,
                "updatedAt": updatedAt,
                "total_folders": len(all_folders),
                "folders": all_folders
            }, f, ensure_ascii=False, indent=2)
        return jsonify({
            "project_id": project_id,
            "updatedAt": updatedAt,
            "total_folders": len(all_folders),
            "folders": all_folders,
            "from_cache": False
        })
    except Exception as e:
        print(f"Error obteniendo árbol de carpetas: {e}")
        return jsonify({"error": "Error interno del servidor"}), 500

@app.route('/api/import-users-to-acc-project', methods=['POST'])
def import_users_to_acc_project():
    """Importa usuarios a uno o varios proyectos de Autodesk Construction Cloud (ACC) usando la API Admin v2."""
    access_token = session.get('access_token')
    if not access_token:
        return jsonify({"error": "No hay un token de acceso. Inicia sesión."}), 401

    data = request.get_json()
    project_ids = data.get('project_ids')
    users = data.get('users')

    if not project_ids or not users:
        return jsonify({"error": "Faltan parámetros obligatorios (project_ids, users)"}), 400

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    results = []
    for project_id in project_ids:
        url = f"https://developer.api.autodesk.com/construction/admin/v2/projects/{project_id}/users:import"

        try:
            response = requests.post(url, headers=headers, json={"users": users})
            if response.status_code in (200, 201):
                results.append({
                    "project_id": project_id,
                    "success": True,
                    "result": response.json()
                })
            else:
                results.append({
                    "project_id": project_id,
                    "success": False,
                    "status_code": response.status_code,
                    "error": response.text
                })
        except Exception as e:
            results.append({
                "project_id": project_id,
                "success": False,
                "error": str(e)
            })

    all_success = all(r.get("success") for r in results)
    return jsonify({"success": all_success, "results": results}), 200 if all_success else 207

if __name__ == '__main__':
    app.run(debug=True)
