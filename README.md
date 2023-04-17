
# Red Hat Account extension

This extension plugs into Podman Desktop an authentication provider that allows login to Red Hat SSO

# Run and build



To rebuild podman-desktop and OpenShift Local extension run:

```shell
  yarn build
```

To execute this extension into Podman Desktop, uses one of these commands:

```shell
  podman-desktop --extension-folder this_folder
```

if using the released bits from Podman Desktop

or 

```shell
  yarn watch --extension-folder this_folder
```

from the Podman Desktop source folder if using the develpment version from Podman Desktop
