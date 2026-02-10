interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
}

interface Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}
