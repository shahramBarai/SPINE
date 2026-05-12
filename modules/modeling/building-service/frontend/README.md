# Building Service Frontend

This app now supports live data from the Python building-service API.

## Configure API URL

Set a Vite environment variable before starting dev server:

```powershell
$env:VITE_BUILDING_API_BASE_URL="http://localhost:8000/api"
```

## Run Frontend

```powershell
npm install
npm run dev
```

## Notes

- Left sidebar project tree and sensor palette now query the API.
- Bottom semantic table now queries API triples.
- Top action buttons now execute backend actions using the IFC path input field.
- Enter either an IFC folder path or a single .ifc file path in the top input, then click:
	- Load IFC -> validates and lists available IFC files
	- Convert to TTL -> runs conversion only
	- Sync to Fuseki -> convert + encoding fix + upload
- If API is unavailable, the UI falls back to local mock data from twin-data.
