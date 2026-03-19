import { useIsAuthenticated, useMsal, MsalAuthenticationTemplate } from "@azure/msal-react";
import { InteractionType } from "@azure/msal-browser";
import { getRoleFromToken, loginRequest } from "./authConfig";
import FleetApp from "./FleetApp";

function LoadingComponent() {
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1d5c52,#2a7d6f,#4db6a4)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:16,padding:"40px",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
        <div style={{width:72,height:72,background:"linear-gradient(135deg,#2a7d6f,#4db6a4)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:24,fontWeight:700,color:"#fff"}}>J+S</div>
        <p style={{color:"#6b7f7c",fontSize:14}}>Accesso in corso...</p>
      </div>
    </div>
  );
}

function ErrorComponent({error}) {
  return <div style={{padding:20,color:"red"}}>Errore: {error?.message}</div>;
}

function AppContent() {
  const { accounts } = useMsal();
  const account = accounts[0];
  const currentUser = {
    id: account.localAccountId,
    name: account.name,
    email: account.username,
    role: getRoleFromToken(account),
  };
  return <FleetApp currentUser={currentUser} />;
}

export default function AppWrapper() {
  return (
    <MsalAuthenticationTemplate
      interactionType={InteractionType.Redirect}
      authenticationRequest={loginRequest}
      errorComponent={ErrorComponent}
      loadingComponent={LoadingComponent}
    >
      <AppContent />
    </MsalAuthenticationTemplate>
  );
}