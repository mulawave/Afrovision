allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory = rootProject.layout.buildDirectory.dir("../../build").get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    // Only redirect build dir if the subproject is on the same drive root as the
    // new build directory — Gradle cannot relativize paths across Windows drives.
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.afterEvaluate {
        val projectRoot = project.projectDir.toPath().root
        val buildRoot = newSubprojectBuildDir.asFile.toPath().root
        if (projectRoot == buildRoot) {
            project.layout.buildDirectory.value(newSubprojectBuildDir)
        }
    }
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
