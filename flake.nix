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
            src = builtins.path {
              path = ./.;
              filter =
                path: _type:
                let
                  name = builtins.baseNameOf path;
                in
                name != "flake.nix" && name != "flake.lock" && name != ".git";
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
              bun install --frozen-lockfile
              runHook postBuild
            '';
            installPhase = ''
              runHook preInstall
              mkdir -p $out
              cp -a . $out/
              rm -rf $out/.git $out/app/dist
              runHook postInstall
            '';
            outputHashMode = "recursive";
            outputHashAlgo = "sha256";
            outputHash =
              {
                x86_64-linux = "sha256-bAoKsGJv6eNSOcsVDYvmk0p7X7lxYD4JBUGLBShfQI0=";
                aarch64-darwin = "sha256-pAc/mYJHtvQfjxccLnZ9ZBfTIsTix/NjZxSXlrWu86s=";
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
            cp -a ${bunDeps}/. .
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
