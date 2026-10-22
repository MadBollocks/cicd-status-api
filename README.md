# CI/CD Status API

This is a small academic project created to demonstrate a complete CI/CD delivery path. It exposes a JSON status page and a health check. The application is intentionally simple so the assessed work is the automation, not application complexity.

## Pipeline stages

The [`Jenkinsfile`](./Jenkinsfile) performs these stages automatically:

1. **Checkout** - Jenkins checks out the latest GitHub commit.
2. **Build and Test** - Node.js runs the automated tests.
3. **Docker Build** - Jenkins builds the image from [`Dockerfile`](./Dockerfile).
4. **Push Image** - The image is pushed to Docker Hub using the Jenkins credential `dockerhub-credentials`.
5. **Deploy to Minikube** - Kubernetes applies [`k8s/deployment.yaml`](./k8s/deployment.yaml) and [`k8s/service.yaml`](./k8s/service.yaml).
6. **Verify** - Jenkins checks the pod, Deployment, Service, rollout, and Minikube URL.

The image tag is the Jenkins build number, so every source-code change produces a traceable image and Kubernetes rollout.

## Run locally

```text
npm test
node src/server.js
```

Open `http://localhost:8080/` or `http://localhost:8080/health`.

## Jenkins on AWS setup

Use an Ubuntu AWS EC2 instance with enough capacity for Jenkins, Docker, and Minikube (at least 4 GB RAM; 8 GB is more comfortable). Install Java, Jenkins, Docker, kubectl, and Minikube. Add the Jenkins user to the Docker group, then restart Jenkins.

Install these Jenkins plugins:

- Pipeline
- Git
- Credentials Binding

Create a Jenkins **Username with password** credential with ID `dockerhub-credentials`. Use a Docker Hub access token as the password, not your Docker Hub account password.

Create a Pipeline job, choose **Pipeline script from SCM**, select Git, enter the GitHub repository URL, and set the script path to `Jenkinsfile`. Add a global or job environment variable named `DOCKERHUB_USERNAME` containing the Docker Hub username. Build the job.

## One-time AWS commands

Run this single block on the Ubuntu EC2 instance after SSH login. Replace only the values marked with `<...>`.

```bash
set -e
sudo apt-get update
sudo apt-get install -y fontconfig openjdk-17-jre docker.io curl conntrack
sudo systemctl enable --now docker
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee /usr/share/keyrings/jenkins-keyring.asc >/dev/null
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" | sudo tee /etc/apt/sources.list.d/jenkins.list >/dev/null
sudo apt-get update
sudo apt-get install -y jenkins
sudo usermod -aG docker jenkins
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
rm -f kubectl minikube-linux-amd64
sudo systemctl restart jenkins
sudo usermod -aG docker jenkins
sudo -u jenkins -H minikube start --driver=docker --cpus=2 --memory=3072
sudo -u jenkins -H minikube status
```

In the EC2 security group, allow TCP port `8080` only from your IP for Jenkins. Do not expose Docker or Kubernetes ports publicly. The Minikube application is verified from the Jenkins host using `minikube service cicd-status-api --url`.

## Demonstrating the second run

After the first successful build, change the `message` in `src/server.js`, commit, and push:

```bash
git add src/server.js
git commit -m "Update deployed status message"
git push origin main
```

Run Jenkins again. The new build number creates a new Docker tag and updates the Kubernetes Deployment. Show the changed response and the Jenkins console output for the second run.

## Submission checklist

- GitHub repository URL
- Jenkinsfile
- Dockerfile
- `k8s/deployment.yaml` and `k8s/service.yaml`
- Screenshots of Jenkins stages, Docker Hub image tags, running pod/Deployment/Service, and the application response
- This README as the brief deployment report
