# Prompt History - Price Runner App Development

This file contains all the prompts given during the development of the Price Runner application.

---

## 1. Initial CSV Generation
**Prompt:**
```
create a file in the folder price runner. The file will be a python script that generates a list of llm models and their price per token I want the list to be saved in a csv and i want the following collumns a. model name b price per token c. provider (aws,google,opeai,azure or if you add 3 more) d mmu score of the model e model size
```

---

## 2. Full-Stack Web Application
**Prompt:**
```
Now I want a react page that loads the csv and present the info in a table in web page. Can you generate that webapp? Make the web app to be with frontEnd and backend. The FrontEnd to poll from the backend and the backend to read the csv and return back the info to the frond. Desing the backeend in away that in the future the csv file to be changed with a database call. Create the front and the backend in a new folder in this dir. The folder should be named pricer-runner-web-app
```

---

## 3. Prompt Cost Calculator
**Prompt:**
```
in the web app I want a box above the price per token table that will allow me to run a prompt. I want when i type the promtp and click a button namesd submit the following to happen : The total cost of the prompt to be presnted for all the models shorted by the cheepest.
```

---

## 4. Backend API Endpoint
**Prompt:**
```
i want the calculation to happen in the backend and the backend to expose an api named as get_best_price_for_prompt
```

---

## 5. Error Fix Request
**Prompt:**
```
i am getting an error when i click calculate . 404
```

---

## 6. Browser Access Question
**Prompt:**
```
can i use your browser ?
```

---

## 7. Swagger API Documentation
**Prompt:**
```
the error remains with the status . can you get me how to access the swager apis to test from there
```

---

## 8. Modal with Savings Percentage
**Prompt:**
```
i want the price estimations to pop up in a new modal that will close when an close button is hit. In addition i want to show the percentage of money saved between the most expensive and the most cheep model
```

---

## 9. Theme System
**Prompt:**
```
i want 3 differet styles to be created . One with black and white theme, one with navy blue, and one profile modern and proffetional that you pick , I want to select the style of the web page by a drop down
```

---

## 10. Side Navigation Menu
**Prompt:**
```
the filters by provider i wanted abobe the price list tavle i want a side navigation menu where i can have the selection of the prompt tab . when i make that selection i want the prompt section to appear . In the side navigation or burger menu i want threr options. Home and playground Home will direct to the price table playground will direct to the prompt
```

---

## 11. Burger Menu Toggle
**Prompt:**
```
make the side nav clickable with a byrget meny icon
```

---

## 12. Theme in Sidebar & Header Styling
**Prompt:**
```
the theme I woulike to have it in the side bar. the Header with the PriceRunner can it be with white background , when i have white and black theme . Can we use Roboto Condenced as font
```

---

## 13. Remove Borders from Header
**Prompt:**
```
I want also the element that says "Price Runner - LLM Model Pricing" to have white background. Also I dont want black border lines around the boxes of of auto-refreshing , filter-by provider .
```

---

## 14. Remove Borders from Burger Menu
**Prompt:**
```
Remove the black border lines from the burger menu button too, but also the box of the "Price Runner - LLM Model Pricing"
```

---

## 15. Move Last Updated to Sidebar
**Prompt:**
```
the last updated box can it be in the burger menu ?
```

---

## 16. Remove Shadows
**Prompt:**
```
🚀 Price Runner - LLM Model Pricing this box can it without shadow and to look like it is in the same level as all the other boxes, I dont want to have shadows in the boxes and I want them to look as all of them are in the same level.
```

---

## 17. Total Models Display & Table Filters
**Prompt:**
```
The total model showing can it be in the same line as when filtering by provider. CAn in the table i have the option to filter based on every collumn ?
```

---

## 18. Inline Search Fields
**Prompt:**
```
I want a search field in model name , I want it in the same line as the column title. Same as the provider. in Price per token i just want an arrow next to the title to just show if i can filter based on lowest or hiegst .
```

---

## 19. Remove Filter Boxes
**Prompt:**
```
rwmove the boxes from MMLU Score Model Size
```

---

## 20. Multi-Select Model Comparison
**Prompt:**
```
In prompt where i give it input. I want above it to have the possibility to multiselect models that will be used for comparing the pricing of the pompts. So I want the system by default to give me results for the price perventage gain i get between the cheepest model with and the more expensive this is how it used to work , and then to also provide price gain percentage on the user selected models. I want the system in each case to mention the models compared and what was the cheapest
```

---

## 21. Dropdown Multi-Select & Modal Fix
**Prompt:**
```
you understood exactly what i wanted to do. bu can the models be relieved in a drop down list where i can just multiselect. Also the pop up page when i click submit button is not working now
```

---

## 22. Prompt Toggle & Bar Chart
**Prompt:**
```
in the cost comparison results can you not show the prompt ? Show it only if a togle exists that says see prompt. Can i have a bar chart where each bar is the price of each of selected model and also a bar for the cheepest model and a bar for the most expensive
```

---

## 23. Remove Icons
**Prompt:**
```
can you also remove all the icons from the app. Like the rocket icon the home and the icon next to playground
```

---

## 24. Bar Chart Toggle
**Prompt:**
```
in the bar add a toggle button too
```

---

## 25. AI Answer Feature
**Prompt:**
```
in the ui I want to have an option to select that will mention "Try AI answer from the best AI model"
```

---

## 26. Prompt History File
**Prompt:**
```
CAn you create a prompt history file , with all the prompts i have given so far. Save that file in the root folder of the project
```

---

## 27. Chat Prompt History
**Prompt:**
```
I want a prompt history of the prompts i have given you in this chat. The prompts for builidng the app
```

---

## 28. Auto-Save Future Prompts
**Prompt:**
```
For now on all the prompts I give I want them to be saved on that file. Inclunding this one.
```

---

## 29. Split-Screen Price Comparison Layout
**Prompt:**
```
In the price comparison tab can you split the screen in 2 and in the left side have the prompt input panel, and the right show the price comparison results instead of having a pop up. can the prompt take 70% of the sceen and results 30%
```

---

## 30. Fix Horizontal Scrolling
**Prompt:**
```
the results expand in my screen i want the whole app to fit 100% in the screen not to scroll on the left or right
```

---

## 31. Prometheus + Grafana Stack with Kubernetes
**Prompt:**
```
For the needs of the cost comparison results setup a small prometheus graphana stack where I want you to save every prompt comparison. I want in the UI to present an empbended graphana chart with the line chart of the savings per prompt. Present the value of savings as percentage. 

I want the backends to have a prometheus exporter for getting the metrics. 

Can i have this solution with dockers and containers in kubernetes ?  setup a kind kubernetes cluster and run the  services there. 

Give me a port forward for the ui . 
Save this prompt in the prompt file 
```

---

## 32. Position Cost Comparison Results Above Grafana
**Prompt:**
```
CAn you position Cost Comparison Results panel above the graphana dashboard?
```

---

## 33. Hide Grafana Chart and Fix Port Forwarding
**Prompt:**
```
can you hide the graphana line graph from the ui . 
In addition the graphana link is not reachable can you enable portforworfing for this tool pass me the graphana url 
```

---

## 34. Installation Script with Local/Kubernetes Flag
**Prompt:**
```
So all the prompts that I'm gonna give I want to be added in the file called Prompt History Chat. And the prompt that I want to ask you now is to give me a script Cold installation, where I want to have a flag defining the installation  when that flag is local then we install the web app locally. When the flag is not there then We have the Kubernetes installation. When I install locally, I don't want to export any Prometheus metrics from my backend services.
```

---

## 35. Start and Deploy Scripts
**Prompt:**
```
And now I want you to give me a script to To start the execution of the web app locally, or to deploy the One script to start execution locally and one script to deploy everything to the Kubernetes cluster. So when I install the Kubernetes, I want them to have a script to deploy. to the Kubernetes cluster.
```

---

## 36. README Documentation
**Prompt:**
```
In the readme file that exists in the root folder, add the instruction and text on what those scripts are doing.
```

---

## 37. Envoy AI Gateway Installation
**Prompt:**
```
I want to end for Envoy AI Getaway to be installed in the cluster. And I want through that getaway to expose the front end application and the URL that I want to be exposed is bestai.se
```

---

## 38. /etc/hosts Configuration Instruction
**Prompt:**
```
this is prompt so save it in the   prompt_history_chat file. What you need to do
Add this line to your /etc/hosts file:
127.0.0.1 bestai.se
This is not a DNS server setup—it's a local hostname mapping that tells your computer to resolve bestai.se to localhost.
```

---

## 39. Update Images Script
**Prompt:**
```
can you give me a script to only update build and update relevant images when i change the code of the web app. I dont want to reboot the k8s cluster all the time. I want only the relevant CRDs to be updated.
```

---

## 40. Integrate Envoy Access Script into Deployment
**Prompt:**
```
can you add this ./setup-envoy-access.sh in the overall installation script. So as to have an end to end process. Can you document in the readme what the script does. Please remember to save the promts in the prompt history
```

---

## 41. OpenAI-Compatible API via Envoy Gateway
**Prompt:**
```
I want Envoy GW to expose an openAI compatible API . I want this to be connected to no model now. Is it possible ?
```

---

## 42. Swagger API Access for OpenAI Service
**Prompt:**
```
how to access it with swagger api ?
```

---

## 43. Grafana Dashboard for Connections Monitoring
**Prompt:**
```
create for me a graphana board that shows the connections to the webapp and the connections to the openAI compatible api .I want to access that board with port forwarding.
```

---

## 44. SSO Login & Multi-Tenant Platform Requirements
**Prompt:**
```
Reference: SSO-login-prompt.txt
```
**Note:** This was a major feature addition for multi-tenant authentication with Keycloak SSO, OpenBao API key management, and role-based access control. However, the authentication features have been reverted/removed from the current codebase.

---

## Current Application State (as of latest changes)

### Architecture
- **Frontend**: React application running on port **3000**
- **Backend**: Node.js/Express API running on port **3001**
- **No Authentication**: Authentication features (Keycloak, OpenBao, backend-auth-service) have been removed/reverted

### Services Started by `start-local.sh`
- ✅ Backend server (port 3001)
- ✅ Frontend dev server (port 3000)
- ❌ Auth services NOT started (backend-auth-service, Keycloak, OpenBao, PostgreSQL)

### Configuration Files
- `pricer-runner-web-app/frontend/vite.config.js`: Frontend port 3000, proxy to backend 3001
- `pricer-runner-web-app/backend/server.js`: Backend port 3001
- `start-local.sh`: Starts only backend and frontend (no auth services)

### Available Features
- ✅ LLM model pricing table with filtering and sorting
- ✅ Prompt cost calculator
- ✅ Multi-model cost comparison
- ✅ Theme selector (black/white, navy blue, modern)
- ✅ Side navigation with burger menu
- ✅ AI answer feature
- ✅ Grafana chart integration
- ❌ Authentication/SSO (removed)
- ❌ API key management (removed)
- ❌ Organization/Project management (removed)

### Notes
- The `backend-auth-service` directory still exists in the project but is not being used or started
- All authentication-related frontend components have been removed
- The application is back to the original Price Runner functionality without multi-tenant features

---

## 45. Add Organization Admin Script
**Prompt:**
```
when i create an organization user in keycloak then you need to update the back end systems with that organization and the user assigned to it. Now I have the org-admin user in keycloak . Can you change this name to org-admin-volvo and then initiate teh backend with an organization named volvo where the user belongs. 

Can you create a script called add_organization_admin where it takes as parameter the name of the org and the user. 

This script should update the keycloack and the backend systems.
```

**Implementation:**
- Created `add_organization_admin.sh` script that:
  - Takes organization name and username as parameters (optional password, defaults to "OA")
  - Creates or updates user in Keycloak with organization-admin role
  - Creates organization in backend database via auth service API
  - Assigns user to organization with OA (Organization Admin) role
  - Uses Keycloak admin API and backend auth service API
  - Provides colored output and error handling

**Usage:**
```bash
./add_organization_admin.sh <organization_name> <username> [password]
./add_organization_admin.sh volvo org-admin-volvo OA
```

**Example:**
- Renamed `org-admin` to `org-admin-volvo` in Keycloak
- Created "volvo" organization in backend
- Assigned `org-admin-volvo` user to "volvo" organization with OA role

---

## Notes

- All prompts were implemented successfully
- The application includes: CSV generation, full-stack web app (React + Node.js/Express), cost calculation, theming system, side navigation, filtering, sorting, multi-model comparison, bar charts, and AI answer integration
- The backend is designed to be easily swappable with a database in the future
- All styling uses CSS variables for theme support
- The app uses Roboto Condensed font throughout

---

## 46. API Key Management UX + Org/User/Role Requirements
**Prompt:**
Reference: `API-KEY-UI.txt` (1-37)
```text
1.1 System Administrator (SA)
A System Administrator has the following responsibilities:
-View all organization users in the UX the users are in Keycloak.
- Through the UI Assign users to the correct organization this should be reflected  in backend systems.
- Create in the UI organization users and save them in Keycloak and assign them the Organization Administrator (OA) role.
- Assign newly created OAs to an organization during user creation.
- Be in position to create an organization via the UI and reflect this in the backend systems

1.2 Organization Administrator (OA)
An Organization Administrator:
- Must belong to exactly one organization.
- Can create and manage Projects within their organization. This should happen from the UI
- From the UI Can create API Keys for their organization. Reflect this to OpenBao 
- From the UI Can assign API Keys to one or more projects within the same organization.

When an OA creates an API Key, the UI must allow configuration of the following fields:
Reference name
Expiration (in days)
Rate limits
Traffic policies

So the relevant above entries entries in the UI are needed  

3 Persistence
All API Key configurations and relations with projects and organizations must be stored in:
OpenBao (for secret management)
PostgreSQL (for metadata and relational data)

Users with the Organization Administrator role must have their organization name included as a group claim in their token
-The organization claim must be reflected in the issued access token.
- Backend services must rely on this token claim to determine organization context and authorization.
```

---

## 47. Envoy AI Gateway + TinyLlama on kind (no port-forward)
**Prompt:**
```text
I want you to give me those for an envoy ai gateway setting. So I want my tiny model to be deployed behind an envoy ai gw, I want all the necessary files for that , from the pod creation till deploying via AI GW through an openAI compatible api.

Also: prefer an approach and update the scripts so I can access bestai.se locally without kubectl port-forward. Document things in the prompt history.
```

---

## 48. AI GW CRDs + why not HTTPRoute
**Prompt:**
```text
when you deploy the models do you also create and httpRoute object? What objects CRD do you generate list them one by one with a small description 7 words on what each one is doing

can you save those to a readme named AI GW CRDS.
can you argue why you dont use an httproute again?
```
