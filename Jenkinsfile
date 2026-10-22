pipeline {
    agent any

    environment {
        REGISTRY = 'docker.io'
        IMAGE_REPOSITORY = "${DOCKERHUB_USERNAME}/cicd-status-api"
        IMAGE_TAG = "${BUILD_NUMBER}"
        FULL_IMAGE = "${DOCKERHUB_USERNAME}/cicd-status-api:${BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build and Test') {
            steps {
                sh 'node --version'
                sh 'npm test'
            }
        }

        stage('Docker Build') {
            steps {
                sh 'docker build --tag "$FULL_IMAGE" .'
            }
        }

        stage('Push Image') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASSWORD'
                )]) {
                    sh '''
                        printf '%s' "$DOCKER_PASSWORD" | docker login "$REGISTRY" \
                            --username "$DOCKER_USER" --password-stdin
                        docker push "$FULL_IMAGE"
                        docker logout "$REGISTRY"
                    '''
                }
            }
        }

        stage('Deploy to Minikube') {
            steps {
                sh '''
                    sed "s|IMAGE_PLACEHOLDER|$FULL_IMAGE|g" k8s/deployment.yaml \
                        | kubectl apply -f -
                    kubectl apply -f k8s/service.yaml
                    kubectl rollout status deployment/cicd-status-api --timeout=120s
                '''
            }
        }

        stage('Verify') {
            steps {
                sh '''
                    kubectl get pods -l app=cicd-status-api -o wide
                    kubectl get deployment cicd-status-api
                    kubectl get service cicd-status-api
                    minikube service cicd-status-api --url
                '''
            }
        }
    }

    post {
        always {
            sh 'docker image prune --force || true'
        }
    }
}
