{
  description = "xiv-market — FFXIV market board viewer (Solid.js + Vite + bun)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

      mkPackage =
        pkgs:
        let
          bunDeps = pkgs.stdenv.mkDerivation {
            pname = "xiv-market-bun-deps";
            version = "0.0.0";
            src = pkgs.lib.fileset.toSource {
              root = ./.;
              fileset = pkgs.lib.fileset.unions [
                ./package.json ./bun.lock ./app/package.json
                ./packages/shared/package.json ./packages/ui/package.json
              ];
            };
            nativeBuildInputs = [
              pkgs.bun
              pkgs.nodejs_24
              pkgs.cacert
            ];
            buildPhase = ''
              runHook preBuild
              export HOME=$TMPDIR
              export BUN_INSTALL_CACHE_DIR=$TMPDIR/bun-cache
              export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
              bun install --frozen-lockfile --ignore-scripts \
                --os=${if pkgs.stdenv.hostPlatform.isDarwin then "darwin" else "linux"} \
                --cpu=${if pkgs.stdenv.hostPlatform.isAarch64 then "arm64" else "x64"}
              runHook postBuild
            '';
            installPhase = ''
              runHook preInstall
              mkdir -p $out
              cp -a node_modules $out/
              for workspace in app packages/shared packages/ui; do
                if [ -d $workspace/node_modules ]; then
                  mkdir -p $out/$workspace
                  cp -a $workspace/node_modules $out/$workspace/
                fi
              done
              runHook postInstall
            '';
            # Keep downloaded package contents identical across builders.
            dontFixup = true;
            outputHashMode = "recursive";
            outputHashAlgo = "sha256";
            outputHash =
              {
                x86_64-linux = "sha256-3/DE0LkrC6melJmlKW4pesdnC6SaEGRWi81gSPluSnc=";
                aarch64-darwin = "sha256-0+02EGB6uaDnfmnGOamCLafjcKck2dgguutwrU+d7Mk=";
              }
              .${pkgs.stdenv.hostPlatform.system}
                or (throw "xiv-market bun dependencies hash is not pinned for ${pkgs.stdenv.hostPlatform.system}");
          };
        in
        pkgs.stdenv.mkDerivation {
          pname = "xiv-market";
          version = "0.0.0";
          src = ./.;
          nativeBuildInputs = [
            pkgs.bun
            pkgs.nodejs_24
          ];
          buildPhase = ''
            runHook preBuild
            # The fixed-output cache contains dependencies only; source always
            # comes from this revision.
            cp -a ${bunDeps}/node_modules .
            for workspace in app packages/shared packages/ui; do
              if [ -d ${bunDeps}/$workspace/node_modules ]; then
                mkdir -p $workspace
                cp -a ${bunDeps}/$workspace/node_modules $workspace/
              fi
            done
            chmod -R u+w .
            patchShebangs node_modules
            bun run build
            runHook postBuild
          '';
          installPhase = ''
            runHook preInstall
            mkdir -p $out
            cp -r app/dist $out/dist
            cp app/public/items.json $out/items.json
            cp scripts/render_item_report.py $out/render_item_report.py
            runHook postInstall
          '';
          meta.description = "xiv-market static site and item-data renderer";
        };
    in
    {
      packages = forAllSystems (
        pkgs:
        let
          market = mkPackage pkgs;
        in
        {
          default = market;
          xiv-market = market;
        }
      );

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            bun
            nodejs_24 # tsc / vite 需要 node 兼容运行时
            (python3.withPackages (ps: [ ps.requests ]))
          ];

          shellHook = ''
            echo "xiv-market dev shell"
            echo "  bun:  $(bun --version)"
            echo "  node: $(node --version)"
          '';
        };
      });
    };
}
